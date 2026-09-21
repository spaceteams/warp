import { buildRuntime, type InferRepo, repo, usecase } from "@spaceteams/warp";
import { describe, expect, it } from "vitest";

// Repository example — bundling CRUD operations into a repo component
//
// `repo` groups multiple method factories into a single component with
// `kind: "repo"`. Each method is wrapped so that middleware fires at
// invocation time. This is the preferred way to organise data-access
// operations in Warp.
//
// Key points:
// - `repo({ name: "userRepo" }, { find, create, deactivate })` produces a
//   factory whose output is `{ find: ..., create: ..., deactivate: ... }`.
// - Context requirements from all inner factories are intersected automatically.
// - The repo factory can be used with `component()` like any other factory.
// - `InferRepo` extracts the output type for use in dependent components.

// ---------------------------------------------------------------------------
// A simple "user" repo that bundles three operations
// ---------------------------------------------------------------------------

type Ctx = { db: Map<string, { name: string; active: boolean }> };

const userRepo = repo(
  { name: "userRepo" },
  {
    find: (ctx: Ctx) => async (id: string) => {
      return ctx.db.get(id);
    },
    create: (ctx: Ctx) => async (id: string, name: string) => {
      ctx.db.set(id, { name, active: true });
      return { id, name };
    },
    deactivate: (ctx: Ctx) => async (id: string) => {
      const user = ctx.db.get(id);
      if (!user) return false;
      user.active = false;
      return true;
    },
  },
);

// Use `InferRepo` to extract the module's output type for dependents.
type UserRepo = InferRepo<typeof userRepo>;

// A usecase that depends on the user repo — it receives the whole
// bundle as `users` and can call any operation on it.
const onboardUser = usecase<{ users: UserRepo }, [string, string], string>(
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

describe("bundling into repo", () => {
  function setup() {
    const db = new Map<string, { name: string; active: boolean }>();
    const { resolve, component, explain } = buildRuntime().provide({ db });
    const graph = component(onboardUser, {
      users: component(userRepo),
    });
    return { db, resolve, component, explain, graph };
  }

  it("can be explained", () => {
    const { explain, graph } = setup();
    expect(explain(graph, "ascii", true)).toMatchInlineSnapshot(`
      "└── onboard-user [usecase]
          └── users -> userRepo [repo]"
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

  it("supports deactivation through the repo", async () => {
    const { resolve, component, db } = setup();
    db.set("u2", { name: "Bob", active: true });

    // The repo can also be resolved directly, without a wrapping usecase.
    const users = await resolve(component(userRepo));

    expect(await users.deactivate("u2")).toBe(true);
    expect(db.get("u2")).toEqual({ name: "Bob", active: false });

    // Deactivating a non-existent user returns false.
    expect(await users.deactivate("unknown")).toBe(false);
  });
});

describe("using repo directly", () => {
  function setup() {
    const db = new Map<string, { name: string; active: boolean }>();
    const { resolve, component, explain } = buildRuntime().provide({ db });
    const graph = component(userRepo);
    return { db, resolve, component, explain, graph };
  }

  it("can be explained", () => {
    const { explain, graph } = setup();
    expect(explain(graph, "ascii", true)).toMatchInlineSnapshot(`"└── userRepo [repo]"`);
  });

  it("can use repo", async () => {
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
// Repos that need different context slices
// ---------------------------------------------------------------------------

describe("context intersection", () => {
  // Two repos that each require a different part of the context.
  const dataRepo = repo(
    { name: "dataRepo" },
    {
      fromDb: (ctx: { db: { query: () => string } }) => async () => ctx.db.query(),
      fromCache: (ctx: { cache: { get: () => string } }) => async () => ctx.cache.get(),
    },
  );

  it("intersects context requirements from all inner factories", async () => {
    const { resolve, component } = buildRuntime().provide({
      db: { query: () => "db-result" },
      cache: { get: () => "cache-result" },
    });

    const data = await resolve(component(dataRepo));
    expect(await data.fromDb()).toBe("db-result");
    expect(await data.fromCache()).toBe("cache-result");
  });
});
