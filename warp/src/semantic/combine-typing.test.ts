import { describe, expect, expectTypeOf, it } from "vitest";
import type { InferOut } from "../component";
import type { Middleware } from "../middleware";
import { buildRuntime } from "../runtime";
import { callable } from "./callable";
import { combine, type InferCombined } from "./combine";
import { usecase } from "./usecase";

type Db = { db: { query: () => string } };
type Cache = { cache: { get: () => string } };

const db = { query: () => "from-db" };
const cache = { get: () => "from-cache" };
const wrongDb = { query: () => 123 };
const wrongCache = { get: "invalid" };

const findCallable = callable<Db, [string], string>(
  { name: "find" },
  (ctx) => async (_id) => ctx.db.query(),
);
const createUsecase = usecase<Db, [string, string], string>(
  { name: "create" },
  (ctx) => async (_id, _name) => ctx.db.query(),
);
const cachedCallable = callable<Cache, [], string>(
  { name: "cached" },
  (ctx) => async () => ctx.cache.get(),
);
const factories = { find: findCallable, create: createUsecase, cached: cachedCallable };
type Output = {
  find: (id: string) => Promise<string>;
  create: (id: string, name: string) => Promise<string>;
  cached: () => Promise<string>;
};

describe.each([
  ["callable", callable],
  ["usecase", usecase],
] as const)("%s context baseline", (_name, make) => {
  it("rejects missing or malformed context and preserves valid output", async () => {
    const factory = make<Db, [string], string>(
      { name: "find" },
      (ctx) => async (_id) => ctx.db.query(),
    );

    // Invalid factories are registered only, never resolved or invoked.
    // @ts-expect-error db is missing from the provided context
    buildRuntime().provide({}).component(factory);
    // @ts-expect-error db.query must return a string
    buildRuntime().provide({ db: wrongDb }).component(factory);

    const { component, resolve } = buildRuntime().provide({ db });
    const resolved = await resolve(component(factory));
    expectTypeOf(resolved).toEqualTypeOf<(id: string) => Promise<string>>();
    expect(await resolved("123")).toBe("from-db");
  });
});

it("extracts the combined multi-factory output", () => {
  const combined = combine({ name: "combined" }, factories);
  expectTypeOf<InferCombined<typeof combined>>().toEqualTypeOf<Output>();
});

describe("combine input typing", () => {
  it("preserves outputs when all dependencies are provided", async () => {
    const factory = combine({ name: "users" }, factories);
    const { component, resolve } = buildRuntime().provide({ db, cache });
    const resolved = await resolve(component(factory));

    expectTypeOf(resolved).toEqualTypeOf<Output>();
    expectTypeOf<InferOut<typeof factory>>().toEqualTypeOf<Output>();
    expect(await resolved.find("123")).toBe("from-db");
    expect(await resolved.create("456", "name")).toBe("from-db");
    expect(await resolved.cached()).toBe("from-cache");
  });

  it("infers inline context-free callables and usecases without contextual never", async () => {
    const factory = combine(
      {},
      {
        echo: callable({}, () => async (id: string) => id),
        increment: usecase({}, () => async (value: number) => value + 1),
        constant: () => 42,
      },
    );
    type InlineOutput = {
      readonly echo: (id: string) => Promise<string>;
      readonly increment: (value: number) => Promise<number>;
      readonly constant: number;
    };
    const { component, resolve } = buildRuntime().provide({});
    const resolved = await resolve(component(factory));

    expectTypeOf(resolved).toEqualTypeOf<InlineOutput>();
    expectTypeOf<InferOut<typeof factory>>().toEqualTypeOf<InlineOutput>();
    expect(await resolved.echo("123")).toBe("123");
    expect(await resolved.increment(1)).toBe(2);
    expect(resolved.constant).toBe(42);
  });

  it("preserves inline context annotations and accepts explicit component dependencies", async () => {
    const factory = combine(
      {},
      {
        find: callable({}, (ctx: Db) => async (id: string) => `${ctx.db.query()}:${id}`),
        cached: usecase({}, (ctx: Cache) => async () => ctx.cache.get()),
      },
    );
    const { component, resolve } = buildRuntime().provide({});

    // @ts-expect-error inline factories still require their annotated dependencies
    component(factory);
    // @ts-expect-error the inline callable requires db
    buildRuntime().provide({ cache }).component(factory);
    // @ts-expect-error the inline usecase requires cache
    buildRuntime().provide({ db }).component(factory);

    const resolved = await resolve(
      component(factory, { db: component(() => db), cache: component(() => cache) }),
    );
    expectTypeOf(resolved.find).toEqualTypeOf<(id: string) => Promise<string>>();
    expectTypeOf(resolved.cached).toEqualTypeOf<() => Promise<string>>();
    expect(await resolved.find("123")).toBe("from-db:123");
    expect(await resolved.cached()).toBe("from-cache");
  });

  it("rejects nonfunctions and malformed factory metadata at the composition boundary", () => {
    const { component } = buildRuntime().provide({});
    const malformed = Object.assign(() => 42, { meta: { name: 123 } });

    // @ts-expect-error invalid members must be rejected, not filtered from the record
    const nonfunction = combine({}, { valid: () => 1, invalid: 42 });
    // @ts-expect-error factory metadata must have a string name
    const invalidMeta = combine({}, { valid: () => 1, invalid: malformed });
    component(nonfunction);
    component(invalidMeta);
  });

  it("rejects missing single, multiple, and wrong-shaped dependencies", () => {
    const single = combine({ name: "single" }, { find: findCallable });
    const multiple = combine({ name: "multiple" }, factories);
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

  it("mixes context-free callables and zero-argument factories without losing requirements", async () => {
    const contextFree = {
      echo: callable({ name: "echo" }, () => async (value: string) => value),
      constant: () => 42,
    };
    const mixed = combine({ name: "mixed" }, { find: findCallable, ...contextFree });
    const empty = buildRuntime().provide({});

    // @ts-expect-error context-free siblings must not erase the db requirement
    empty.component(mixed);

    const free = await empty.resolve(empty.component(combine({ name: "free" }, contextFree)));
    expectTypeOf(free.echo).toEqualTypeOf<(value: string) => Promise<string>>();
    expectTypeOf(free.constant).toEqualTypeOf<number>();
    expect(await free.echo("hello")).toBe("hello");
    expect(free.constant).toBe(42);

    const { component, resolve } = buildRuntime().provide({ db });
    const resolved = await resolve(component(mixed));
    expectTypeOf(resolved.find).toEqualTypeOf<(id: string) => Promise<string>>();
    expect(await resolved.find("123")).toBe("from-db");
    expect(await resolved.echo("hello")).toBe("hello");
    expect(resolved.constant).toBe(42);
  });

  it("preserves nested requirements and outputs", async () => {
    const factory = combine(
      { name: "outer" },
      {
        users: combine({ name: "inner" }, { find: findCallable, create: createUsecase }),
        cached: cachedCallable,
      },
    );

    // @ts-expect-error nested db dependency is missing
    buildRuntime().provide({ cache }).component(factory);
    // @ts-expect-error outer cache dependency is missing
    buildRuntime().provide({ db }).component(factory);

    const { component, resolve } = buildRuntime().provide({ db, cache });
    const resolved = await resolve(component(factory));
    expectTypeOf(resolved.users.find).toEqualTypeOf<Output["find"]>();
    expectTypeOf(resolved.users.create).toEqualTypeOf<Output["create"]>();
    expectTypeOf(resolved.cached).toEqualTypeOf<Output["cached"]>();
    expect(await resolved.users.find("123")).toBe("from-db");
    expect(await resolved.users.create("456", "name")).toBe("from-db");
    expect(await resolved.cached()).toBe("from-cache");
  });

  it("intersects plain context factories without requiring callable wrappers", async () => {
    const factory = combine(
      { name: "plain" },
      {
        query: (ctx: Db) => ctx.db.query(),
        get: (ctx: Cache) => ctx.cache.get(),
      },
    );

    // @ts-expect-error both plain factory dependencies are missing
    buildRuntime().provide({}).component(factory);
    // @ts-expect-error cache is missing
    buildRuntime().provide({ db }).component(factory);
    // @ts-expect-error db is missing
    buildRuntime().provide({ cache }).component(factory);

    const { component, resolve } = buildRuntime().provide({ db, cache });
    const resolved = await resolve(component(factory));
    expectTypeOf(resolved.query).toEqualTypeOf<string>();
    expectTypeOf(resolved.get).toEqualTypeOf<string>();
    expect(resolved).toEqual({ query: "from-db", get: "from-cache" });
  });

  it("preserves a factory's union context instead of requiring both alternatives", async () => {
    const factory = combine(
      { name: "either" },
      {
        read: (ctx: Db | Cache) => ("db" in ctx ? ctx.db.query() : ctx.cache.get()),
        constant: () => 42,
      },
    );
    expectTypeOf<Parameters<typeof factory>[0]>().toEqualTypeOf<Db | Cache>();

    // @ts-expect-error at least one union alternative is required
    buildRuntime().provide({}).component(factory);
    // @ts-expect-error a malformed db satisfies neither alternative
    buildRuntime().provide({ db: wrongDb }).component(factory);

    const dbRuntime = buildRuntime().provide({ db });
    const cacheRuntime = buildRuntime().provide({ cache });
    const fromDb = await dbRuntime.resolve(dbRuntime.component(factory));
    const fromCache = await cacheRuntime.resolve(cacheRuntime.component(factory));
    expectTypeOf(fromDb.read).toEqualTypeOf<string>();
    expectTypeOf(fromCache.read).toEqualTypeOf<string>();
    expect(fromDb).toEqual({ read: "from-db", constant: 42 });
    expect(fromCache).toEqual({ read: "from-cache", constant: 42 });
  });

  it("resolves empty modules without dependencies", async () => {
    const factory = combine({ name: "empty" }, {});
    const { component, resolve } = buildRuntime().provide({});
    const resolved = await resolve(component(factory));

    expectTypeOf(resolved).toEqualTypeOf<Record<never, never>>();
    expectTypeOf<InferOut<typeof factory>>().toEqualTypeOf<Record<never, never>>();
    expect(resolved).toEqual({});
  });

  it("preserves middleware scope and run-option compatibility", async () => {
    type Scope = { requestId: string };
    type Options = { trace: boolean };
    const scoped = callable<Db, [], string, Options, Scope>(
      { name: "scoped", trace: true },
      (ctx) => async () =>
        ctx.run({ trace: true }, (inner) => `${inner.db.query()}:${inner.requestId}`),
    );
    const factory = combine({ name: "scoped-module" }, { scoped, constant: () => 42 });
    const middleware: Middleware<Db, Options, Scope> = (ctx, options, next) =>
      next({ ...ctx, requestId: options.trace ? "traced" : "untraced" });
    const { component, resolve } = buildRuntime().use(middleware).provide({ db });

    const direct = await resolve(component(scoped));
    const resolved = await resolve(component(factory));
    expectTypeOf(resolved.scoped).toEqualTypeOf<() => Promise<string>>();
    expectTypeOf(resolved.constant).toEqualTypeOf<number>();
    expect(await direct()).toBe("from-db:traced");
    expect(await resolved.scoped()).toBe("from-db:traced");
    expect(resolved.constant).toBe(42);

    const missingScope: Middleware<Db, Options> = (ctx, _options, next) => next(ctx);
    // @ts-expect-error matching run options do not supply the required requestId scope
    buildRuntime().use(missingScope).provide({ db }).component(factory);

    const wrongScope: Middleware<Db, Options, { requestId: number }> = (ctx, _options, next) =>
      next({ ...ctx, requestId: 123 });
    // @ts-expect-error requestId must be a string
    buildRuntime().use(wrongScope).provide({ db }).component(factory);

    const wrongOptions: Middleware<Db, { trace: string }, Scope> = (ctx, options, next) =>
      next({ ...ctx, requestId: options.trace ?? "untraced" });
    // @ts-expect-error matching scope does not make string trace options compatible
    buildRuntime().use(wrongOptions).provide({ db }).component(factory);
  });
});
