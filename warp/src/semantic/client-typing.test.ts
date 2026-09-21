import { describe, expect, expectTypeOf, it } from "vitest";
import type { InferOut } from "../component";
import type { Middleware } from "../middleware";
import { buildRuntime } from "../runtime";
import { client } from "./client";

type Db = { db: { query: () => string } };
type Cache = { cache: { get: () => string } };

const db = { query: () => "from-db" };
const cache = { get: () => "from-cache" };
const wrongDb = { query: () => 123 };
const wrongCache = { get: "invalid" };

const factories = {
  find: (ctx: Db) => async (_id: string) => ctx.db.query(),
  create: (ctx: Db) => async (_id: string, _name: string) => ctx.db.query(),
  cached: (ctx: Cache) => async () => ctx.cache.get(),
};

type Output = {
  find: (id: string) => Promise<string>;
  create: (id: string, name: string) => Promise<string>;
  cached: () => Promise<string>;
};

describe("client input typing", () => {
  it("preserves outputs when all dependencies are provided", async () => {
    const factory = client({ name: "users" }, factories);
    const { component, resolve } = buildRuntime().provide({ db, cache });
    const resolved = await resolve(component(factory));

    expectTypeOf(resolved).toEqualTypeOf<Output>();
    expectTypeOf<InferOut<typeof factory>>().toEqualTypeOf<Output>();
    expect(await resolved.find("123")).toBe("from-db");
    expect(await resolved.create("456", "name")).toBe("from-db");
    expect(await resolved.cached()).toBe("from-cache");
  });

  it("infers inline context-free factories without contextual never", async () => {
    const factory = client(
      {},
      {
        echo: () => async (id: string) => id,
        increment: () => async (value: number) => value + 1,
      },
    );
    type InlineOutput = {
      readonly echo: (id: string) => Promise<string>;
      readonly increment: (value: number) => Promise<number>;
    };
    const { component, resolve } = buildRuntime().provide({});
    const resolved = await resolve(component(factory));

    expectTypeOf(resolved).toEqualTypeOf<InlineOutput>();
    expectTypeOf<InferOut<typeof factory>>().toEqualTypeOf<InlineOutput>();
    expect(await resolved.echo("123")).toBe("123");
    expect(await resolved.increment(1)).toBe(2);
  });

  it("preserves inline context annotations and accepts explicit component dependencies", async () => {
    const factory = client(
      {},
      {
        find: (ctx: Db) => async (id: string) => `${ctx.db.query()}:${id}`,
        cached: (ctx: Cache) => async () => ctx.cache.get(),
      },
    );
    const { component, resolve } = buildRuntime().provide({});

    // @ts-expect-error inline factories still require their annotated dependencies
    component(factory);
    // @ts-expect-error the inline find requires db
    buildRuntime().provide({ cache }).component(factory);
    // @ts-expect-error the inline cached requires cache
    buildRuntime().provide({ db }).component(factory);

    const resolved = await resolve(
      component(factory, { db: component(() => db), cache: component(() => cache) }),
    );
    expectTypeOf(resolved.find).toEqualTypeOf<(id: string) => Promise<string>>();
    expectTypeOf(resolved.cached).toEqualTypeOf<() => Promise<string>>();
    expect(await resolved.find("123")).toBe("from-db:123");
    expect(await resolved.cached()).toBe("from-cache");
  });

  it("rejects missing single, multiple, and wrong-shaped dependencies", () => {
    const single = client(
      { name: "single" },
      { find: (ctx: Db) => async (_id: string) => ctx.db.query() },
    );
    const multiple = client({ name: "multiple" }, factories);
    const empty = buildRuntime().provide({});

    // These checks stop at registration so invalid context is never used at runtime.
    // @ts-expect-error the single factory still requires db
    empty.component(single);
    // @ts-expect-error both db and cache are missing
    empty.component(multiple);
    // @ts-expect-error cache is missing
    buildRuntime().provide({ db }).component(multiple);
    // @ts-expect-error db is missing
    buildRuntime().provide({ cache }).component(multiple);
    // @ts-expect-error db.query must return a string
    buildRuntime().provide({ db: wrongDb }).component(single);
    // @ts-expect-error cache.get must be a function
    buildRuntime().provide({ db, cache: wrongCache }).component(multiple);
  });

  it("mixes context-free factories without losing requirements", async () => {
    const contextFree = {
      echo: () => async (value: string) => value,
    };
    const mixed = client(
      { name: "mixed" },
      { find: (ctx: Db) => async (_id: string) => ctx.db.query(), ...contextFree },
    );
    const empty = buildRuntime().provide({});

    // @ts-expect-error context-free siblings must not erase the db requirement
    empty.component(mixed);

    const free = await empty.resolve(empty.component(client({ name: "free" }, contextFree)));
    expectTypeOf(free.echo).toEqualTypeOf<(value: string) => Promise<string>>();
    expect(await free.echo("hello")).toBe("hello");

    const { component, resolve } = buildRuntime().provide({ db });
    const resolved = await resolve(component(mixed));
    expectTypeOf(resolved.find).toEqualTypeOf<(id: string) => Promise<string>>();
    expect(await resolved.find("123")).toBe("from-db");
    expect(await resolved.echo("hello")).toBe("hello");
  });

  it("preserves multiple context requirements", async () => {
    const factory = client(
      { name: "outer" },
      {
        find: (ctx: Db) => async (_id: string) => ctx.db.query(),
        cached: (ctx: Cache) => async () => ctx.cache.get(),
      },
    );

    // @ts-expect-error db dependency is missing
    buildRuntime().provide({ cache }).component(factory);
    // @ts-expect-error cache dependency is missing
    buildRuntime().provide({ db }).component(factory);

    const { component, resolve } = buildRuntime().provide({ db, cache });
    const resolved = await resolve(component(factory));
    expectTypeOf(resolved.find).toEqualTypeOf<Output["find"]>();
    expectTypeOf(resolved.cached).toEqualTypeOf<Output["cached"]>();
    expect(await resolved.find("123")).toBe("from-db");
    expect(await resolved.cached()).toBe("from-cache");
  });

  it("resolves empty modules without dependencies", async () => {
    const factory = client({ name: "empty" }, {});
    const { component, resolve } = buildRuntime().provide({});
    const resolved = await resolve(component(factory));

    expectTypeOf(resolved).toEqualTypeOf<Record<never, never>>();
    expectTypeOf<InferOut<typeof factory>>().toEqualTypeOf<Record<never, never>>();
    expect(resolved).toEqual({});
  });

  it("binds methods lazily — only on first invocation", async () => {
    let bindings = 0;

    const example = client(
      { name: "example" },
      {
        find: (_ctx: Db) => {
          bindings++;
          return async (id: string) => `found ${id}`;
        },
      },
    );

    const { component, resolve } = buildRuntime().provide({ db });
    const resolved = await resolve(component(example));

    expect(bindings).toBe(0);

    expect(await resolved.find("1")).toBe("found 1");
    expect(bindings).toBe(1);

    expect(await resolved.find("2")).toBe("found 2");
    expect(bindings).toBe(1);
  });

  it("forwards run options to every method invocation", async () => {
    type TraceOptions = { trace: boolean };
    let lastTraceValue: boolean | undefined;

    const traceMiddleware: Middleware<Db, TraceOptions> = (ctx, options, next) => {
      lastTraceValue = options.trace;
      return next(ctx as any);
    };

    const factory = client(
      { name: "traced-client", trace: true },
      {
        find: (_ctx: Db) => async (id: string) => `found:${id}`,
      },
    );

    const { component, resolve } = buildRuntime().use(traceMiddleware).provide({ db });
    const resolved = await resolve(component(factory));

    expect(lastTraceValue).toBeUndefined();
    expect(await resolved.find("123")).toBe("found:123");
    expect(lastTraceValue).toBe(true);
  });
});
