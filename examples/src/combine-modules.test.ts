import { buildRuntime, callable, combine, type InferCombined, usecase } from "@spaceteams/warp";
import { describe, expect, it } from "vitest";

// Combine example — bundling operations into modules
//
// `combine` groups multiple component factories into a single factory that
// returns an object of their outputs. This is useful for organising related
// operations (e.g. a repository's CRUD methods) into one component that can
// be wired and resolved as a unit.
//
// Key points:
// - `combine({ a, b })` produces a factory whose output is `{ a: ..., b: ... }`.
// - Context requirements from all inner factories are intersected automatically,
//   so the combined component demands everything its parts need.
// - The combined factory can be used with `component()` like any other factory.
// - `InferCombined` extracts the output type for use in dependent components.

// ---------------------------------------------------------------------------
// A simple "user" module that bundles three operations
// ---------------------------------------------------------------------------

type Ctx = { db: Map<string, { name: string; active: boolean }> };

const findUser = callable<Ctx, [string], { name: string; active: boolean } | undefined>(
  { name: "find-user" },
  (ctx) => async (id) => {
    return ctx.db.get(id);
  },
);

const createUser = callable<Ctx, [string, string], { id: string; name: string }>(
  { name: "create-user" },
  (ctx) => async (id, name) => {
    ctx.db.set(id, { name, active: true });
    return { id, name };
  },
);

const deactivateUser = callable<Ctx, [string], boolean>(
  { name: "deactivate-user" },
  (ctx) => async (id) => {
    const user = ctx.db.get(id);
    if (!user) return false;
    user.active = false;
    return true;
  },
);

// Bundle the three operations into a single "userModule" component.
const userModule = combine(
  { name: "userModule" },
  {
    find: findUser,
    create: createUser,
    deactivate: deactivateUser,
  },
);

// Use `InferCombined` to extract the module's output type for dependents.
type UserModule = InferCombined<typeof userModule>;

// A usecase that depends on the combined module — it receives the whole
// bundle as `users` and can call any operation on it.
const onboardUser = usecase<{ users: UserModule }, [string, string], string>(
  { name: "onboard-user" },
  (ctx) => async (id, name) => {
    const existing = await ctx.users.find(id);
    if (existing) {
      return `user ${id} already exists`;
    }
    await ctx.users.create(id, name);
    return `onboarded ${name}`;
  },
);

// ---------------------------------------------------------------------------
// Basic Usage
// ---------------------------------------------------------------------------

describe("bundling into modules", () => {
  function setup() {
    const db = new Map<string, { name: string; active: boolean }>();
    const { resolve, component, explain } = buildRuntime().provide({ db });
    const graph = component(onboardUser, {
      users: component(userModule),
    });
    return { db, resolve, component, explain, graph };
  }

  it("can be explained", () => {
    const { explain, graph } = setup();
    expect(explain(graph, "ascii", true)).toMatchInlineSnapshot(`
      "└── onboard-user [usecase]
          └── users -> userModule [module]"
    `);
  });

  it("onboards a new user", async () => {
    const { resolve, graph, db } = setup();
    const onboard = await resolve(graph);

    expect(await onboard("u1", "Alice")).toBe("onboarded Alice");
    expect(db.get("u1")).toEqual({ name: "Alice", active: true });
  });

  it("rejects duplicate users", async () => {
    const { resolve, graph, db } = setup();
    db.set("u1", { name: "Alice", active: true });

    const onboard = await resolve(graph);
    expect(await onboard("u1", "Alice")).toBe("user u1 already exists");
  });

  it("supports deactivation through the module", async () => {
    const { resolve, component, db } = setup();
    db.set("u2", { name: "Bob", active: true });

    // The combined module can also be resolved directly, without a wrapping usecase.
    const users = await resolve(component(userModule));

    expect(await users.deactivate("u2")).toBe(true);
    expect(db.get("u2")).toEqual({ name: "Bob", active: false });

    // Deactivating a non-existent user returns false.
    expect(await users.deactivate("unknown")).toBe(false);
  });
});

describe("using modules directly", () => {
  function setup() {
    const db = new Map<string, { name: string; active: boolean }>();
    const { resolve, component, explain } = buildRuntime().provide({ db });
    const graph = component(userModule);
    return { db, resolve, component, explain, graph };
  }

  it("can be explained", () => {
    const { explain, graph } = setup();
    expect(explain(graph, "ascii", true)).toMatchInlineSnapshot(`"└── userModule [module]"`);
  });

  it("can use module", async () => {
    const { resolve, graph, db } = setup();
    const module = await resolve(graph);

    expect(await module.create("u1", "Alice")).toEqual({
      id: "u1",
      name: "Alice",
    });
    expect(db.get("u1")).toEqual({ name: "Alice", active: true });
  });
});

// ---------------------------------------------------------------------------
// Combining modules that need different context slices
// ---------------------------------------------------------------------------

describe("context intersection", () => {
  // Two callables that each require a different part of the context.
  const fromDb = callable<{ db: { query: () => string } }, [], string>(
    { name: "from-db" },
    (ctx) => async () => ctx.db.query(),
  );
  const fromCache = callable<{ cache: { get: () => string } }, [], string>(
    { name: "from-cache" },
    (ctx) => async () => ctx.cache.get(),
  );

  // `combine` intersects the two context types: the resulting factory
  // requires both `db` and `cache`.
  const dataModule = combine({ name: "dataModule" }, { fromDb, fromCache });

  it("intersects context requirements from all inner factories", async () => {
    const { resolve, component } = buildRuntime().provide({
      db: { query: () => "db-result" },
      cache: { get: () => "cache-result" },
    });

    const data = await resolve(component(dataModule));
    expect(await data.fromDb()).toBe("db-result");
    expect(await data.fromCache()).toBe("cache-result");
  });
});
