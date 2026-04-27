import { assertType, describe, expect, it } from "vitest";
import { RuntimeBuilder } from "../runtime/runtime-builder";
import { callable } from "./callable";
import { combine, type InferCombined } from "./combine";

describe("combine", () => {
  const getById = callable({ name: "getModelById" }, () => async (id: string) => ({
    id,
    name: "test",
  }));

  const upsert = callable(
    { name: "upsert" },
    () => async (id: string, payload: { name: string }) => ({
      id,
      ...payload,
    }),
  );

  const del = callable({ name: "delete" }, () => async (id: string) => {
    return { deleted: id };
  });

  const modelRepo = combine({
    getById,
    upsert,
    del,
  });

  it("produces a component factory that returns an object of resolved factories", async () => {
    const { component, resolve } = new RuntimeBuilder().provide({});

    const repo = await resolve(component(modelRepo));

    const model = await repo.getById("123");
    expect(model).toEqual({ id: "123", name: "test" });

    const upserted = await repo.upsert("456", { name: "updated" });
    expect(upserted).toEqual({ id: "456", name: "updated" });

    const deleted = await repo.del("789");
    expect(deleted).toEqual({ deleted: "789" });
  });

  it("preserves output types correctly", async () => {
    const { component, resolve } = new RuntimeBuilder().provide({});
    const repo = await resolve(component(modelRepo));

    const model = await repo.getById("1");
    assertType<{ id: string; name: string }>(model);

    const upserted = await repo.upsert("1", { name: "x" });
    assertType<{ id: string; name: string }>(upserted);

    const deleted = await repo.del("1");
    assertType<{ deleted: string }>(deleted);
  });

  it("InferCombined extracts the combined output type", () => {
    type Inferred = InferCombined<typeof modelRepo>;
    assertType<Inferred>({
      getById: async (_id: string) => ({ id: "1", name: "test" }),
      upsert: async (_id: string, _payload: { name: string }) => ({ id: "1", name: "x" }),
      del: async (_id: string) => ({ deleted: "1" }),
    });
  });

  it("works with context-dependent callables", async () => {
    const withCtx = callable(
      { name: "withCtx" },
      (app: { db: { find: (id: string) => string } }) => async (id: string) => {
        return app.db.find(id);
      },
    );

    const combined = combine({ withCtx });

    const { component, resolve } = new RuntimeBuilder().provide({
      db: { find: (id: string) => `found:${id}` },
    });

    const resolved = await resolve(component(combined));
    const result = await resolved.withCtx("abc");
    expect(result).toBe("found:abc");
  });

  it("intersects context types from multiple factories", async () => {
    const needsDb = callable(
      { name: "needsDb" },
      (app: { db: { query: () => string } }) => async () => app.db.query(),
    );
    const needsCache = callable(
      { name: "needsCache" },
      (app: { cache: { get: () => string } }) => async () => app.cache.get(),
    );

    const combined = combine({ needsDb, needsCache });

    // The combined factory requires both db AND cache in the context
    const { component, resolve } = new RuntimeBuilder().provide({
      db: { query: () => "from-db" },
      cache: { get: () => "from-cache" },
    });

    const resolved = await resolve(component(combined));
    expect(await resolved.needsDb()).toBe("from-db");
    expect(await resolved.needsCache()).toBe("from-cache");
  });

  it("works with an empty record", async () => {
    const empty = combine({});
    const { component, resolve } = new RuntimeBuilder().provide({});
    const resolved = await resolve(component(empty));
    expect(resolved).toEqual({});
  });
});
