import { describe, expect, it, vi } from "vitest";
import type { ComponentRef } from "../component";
import { defineFunctionalComponent } from "../component/functional-component";
import type { Middleware, NoRunOptions, NoScopeContext } from "../middleware";
import { createResolver } from "./create-resolver";

function noop<Ctx>(): Middleware<Ctx> {
  return (ctx, _options, next) => next(ctx as Ctx & {});
}
function levelMiddleware(): Middleware<{ level: number }> {
  return (ctx, _options, next) => next({ level: ctx.level + 1 });
}

it("passes ctx through a tower of run calls", () => {
  const ctx = { resource: "1" };
  const resolve = createResolver(noop<typeof ctx>());
  const comp = defineFunctionalComponent<typeof ctx, NoScopeContext, NoRunOptions>();
  const root = resolve(
    comp((a) => a),
    ctx,
  );
  expect(root).toMatchObject(ctx);
  root.run({}, (secondLevel) => {
    expect(secondLevel).toMatchObject(ctx);
    return secondLevel.run({}, async (thirdLevel) => {
      expect(thirdLevel).toMatchObject(ctx);
    });
  });
});

it("applies middleware in run calls", () => {
  const ctx = { level: 0 };
  const resolve = createResolver(levelMiddleware());
  const comp = defineFunctionalComponent<typeof ctx, NoScopeContext, NoRunOptions>();
  const root = resolve(
    comp((a) => a),
    ctx,
  );
  expect(root).toMatchObject({ level: 0 });
  root.run({}, (secondLevel) => {
    expect(secondLevel).toMatchObject({ level: 1 });
    return secondLevel.run({}, async (thirdLevel) => {
      expect(thirdLevel).toMatchObject({ level: 2 });
    });
  });
});

it("creates dependencies", () => {
  const ctx = { level: 0 };
  const resolve = createResolver(levelMiddleware());
  const comp = defineFunctionalComponent<typeof ctx, NoScopeContext, NoRunOptions>();
  const repo = comp((a) => a);
  const root = resolve(
    comp((a) => a, { repo }),
    ctx,
  );
  expect(root.repo).toMatchObject({ level: 0 });
  root.run({}, async (secondLevel) => {
    expect(secondLevel.repo).toMatchObject({ level: 1 });
  });
});

it("creates dependencies lazily", () => {
  const onCreate = vi.fn();
  const ctx = { level: 0 };
  const resolve = createResolver(levelMiddleware());
  const comp = defineFunctionalComponent<typeof ctx, NoScopeContext, NoRunOptions>();
  const repo = comp((a) => {
    onCreate("repo", a.level);
    return a;
  });
  const root = resolve(
    comp(
      (a) => {
        onCreate("root", a.level);
        return a;
      },
      { repo },
    ),
    ctx,
  );

  expect(onCreate).toHaveBeenCalledTimes(1);
  expect(root).toMatchObject({ level: 0 });
  expect(root.repo).toMatchObject({ level: 0 });
  expect(onCreate).toHaveBeenCalledTimes(2);

  root.run({}, (secondLevel) => {
    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(secondLevel.level).toEqual(1);
    expect(secondLevel.repo).toMatchObject({ level: 1 });
    expect(onCreate).toHaveBeenCalledTimes(3);

    secondLevel.run({}, (thirdLevel) => {
      expect(onCreate).toHaveBeenCalledTimes(3);
      expect(thirdLevel.level).toEqual(2);
      expect(thirdLevel.repo).toMatchObject({ level: 2 });
      expect(onCreate).toHaveBeenCalledTimes(4);
    });
  });
  expect(onCreate.mock.calls).toEqual([
    ["root", 0],
    ["repo", 0],
    ["repo", 1],
    ["repo", 2],
  ]);
});

it("detects direct cyclic dependencies", async () => {
  const ctx = { level: 0 };
  const resolve = createResolver(noop<typeof ctx>());

  const component = defineFunctionalComponent<typeof ctx, NoScopeContext, NoRunOptions>();

  const compA = component(
    (run) => run.b,
    {} as { b: ComponentRef<typeof ctx, NoScopeContext, NoRunOptions, unknown> },
  );
  const compB = component((run) => run.a, { a: compA });
  compA.deps = { b: compB };

  expect(() => resolve(compA, ctx)).toThrow("Cyclic dependency: b -> b.a -> b.a.b");
});

it("detects indirect cyclic dependencies", () => {
  const ctx = { level: 0 };
  const resolve = createResolver(noop<typeof ctx>());
  const component = defineFunctionalComponent<typeof ctx, NoScopeContext, NoRunOptions>();

  const compA = component(
    (run) => run.b,
    {} as { b: ComponentRef<typeof ctx, NoScopeContext, NoRunOptions, unknown> },
  );

  const compB = component(
    (run) => run.c,
    {} as { c: ComponentRef<typeof ctx, NoScopeContext, NoRunOptions, unknown> },
  );

  const compC = component((run) => run.a, { a: compA });

  compA.deps = { b: compB };
  compB.deps = { c: compC };

  expect(() => resolve(compA, ctx)).toThrow("Cyclic dependency: b -> b.c -> b.c.a -> b.c.a.b");
});

it("detects self-dependency cycles", () => {
  const ctx = { level: 0 };
  const resolve = createResolver(noop<typeof ctx>());

  const component = defineFunctionalComponent<typeof ctx, NoScopeContext, NoRunOptions>();

  const compA = component(
    (run) => run.self,
    {} as { self: ComponentRef<typeof ctx, NoScopeContext, NoRunOptions, unknown> },
  );

  compA.deps = { self: compA };

  expect(() => resolve(compA, ctx)).toThrow("Cyclic dependency: self -> self.self");
});

it("resolves nested dependencies", async () => {
  const onCreate = vi.fn();
  const ctx = { level: 0 };
  const resolve = createResolver(levelMiddleware());

  const comp = defineFunctionalComponent<typeof ctx, NoScopeContext, NoRunOptions>();
  const connection = comp((a) => {
    onCreate("connection", a.level);
    return a;
  });
  const db = comp(
    (a) => {
      onCreate("db", a.level);
      return a;
    },
    { connection },
  );
  const repo = comp(
    (a) => {
      onCreate("repo", a.level);
      return a;
    },
    { db },
  );
  const root = comp(
    (a) => {
      onCreate("root", a.level);
      return a;
    },
    { repo },
  );

  const result = resolve(root, ctx);

  expect(onCreate).toHaveBeenCalledTimes(1);
  expect(onCreate.mock.calls).toEqual([["root", 0]]);

  // Access repo triggers creation of repo and its dependency db and connection
  const repoInstance = result.repo;
  expect(onCreate).toHaveBeenCalledTimes(2);
  expect(onCreate.mock.calls).toEqual([
    ["root", 0],
    ["repo", 0],
  ]);

  // Access db through repo
  const dbInstance = repoInstance.db;
  expect(onCreate).toHaveBeenCalledTimes(3);
  expect(onCreate.mock.calls).toEqual([
    ["root", 0],
    ["repo", 0],
    ["db", 0],
  ]);

  // Access connection through db
  void dbInstance.connection;
  expect(onCreate).toHaveBeenCalledTimes(4);
  expect(onCreate.mock.calls).toEqual([
    ["root", 0],
    ["repo", 0],
    ["db", 0],
    ["connection", 0],
  ]);

  // In a run scope, dependencies get new instances with updated context
  result.run({}, async (secondLevel) => {
    expect(onCreate).toHaveBeenCalledTimes(4);

    const repo2 = secondLevel.repo;
    expect(onCreate).toHaveBeenCalledTimes(5);
    expect(repo2.level).toBe(1);

    const db2 = repo2.db;
    expect(onCreate).toHaveBeenCalledTimes(6);
    expect(db2.level).toBe(1);

    const connection2 = db2.connection;
    expect(onCreate).toHaveBeenCalledTimes(7);
    expect(connection2.level).toBe(1);
  });

  expect(onCreate.mock.calls).toEqual([
    ["root", 0],
    ["repo", 0],
    ["db", 0],
    ["connection", 0],
    ["repo", 1],
    ["db", 1],
    ["connection", 1],
  ]);
});

it("caches dependencies within the same scope", async () => {
  const onCreate = vi.fn();
  const ctx = { level: 0 };
  const resolve = createResolver(noop<typeof ctx>());

  const comp = defineFunctionalComponent<typeof ctx, NoScopeContext, NoRunOptions>();
  const repo = comp((a) => {
    onCreate("repo", a.level);
    return a;
  });

  const root = comp(
    (a) => {
      onCreate("root", a.level);
      return a;
    },
    { repo },
  );

  const result = resolve(root, ctx);

  expect(onCreate).toHaveBeenCalledTimes(1);
  expect(onCreate.mock.calls).toEqual([["root", 0]]);

  // First access to repo
  const repo1 = result.repo;
  expect(onCreate).toHaveBeenCalledTimes(2);

  // Second access to repo should return cached instance
  const repo2 = result.repo;
  expect(onCreate).toHaveBeenCalledTimes(2);

  // Should be the exact same instance
  expect(repo1).toBe(repo2);
  expect(onCreate.mock.calls).toEqual([
    ["root", 0],
    ["repo", 0],
  ]);
});

it("creates new dependency instances in different scopes", () => {
  const ctx = { level: 0 };
  const resolve = createResolver(levelMiddleware());

  const comp = defineFunctionalComponent<typeof ctx, NoScopeContext, NoRunOptions>();
  const repo = comp((a) => a);
  const root = comp((a) => a, { repo });

  const result = resolve(root, ctx);

  const rootRepo = result.repo;
  expect(rootRepo.level).toBe(0);

  result.run({}, (secondLevel) => {
    const secondRepo = secondLevel.repo;
    expect(secondRepo.level).toBe(1);

    // Different scopes should have different instances
    expect(rootRepo).not.toBe(secondRepo);

    // Within the same scope, should be cached
    const secondRepo2 = secondLevel.repo;
    expect(secondRepo).toBe(secondRepo2);

    secondLevel.run({}, (thirdLevel) => {
      const thirdRepo = thirdLevel.repo;
      expect(thirdRepo.level).toBe(2);

      // Each scope gets its own instance
      expect(thirdRepo).not.toBe(rootRepo);
      expect(thirdRepo).not.toBe(secondRepo);

      // But within the same scope, it's cached
      const thirdRepo2 = thirdLevel.repo;
      expect(thirdRepo).toBe(thirdRepo2);
    });
  });
});

describe("option propagation", () => {
  type OptionType = { action: string };
  type CtxType = { level: number } & { options?: OptionType };

  function optionsCapturingMiddleware(
    receivedOptions: Array<{ scope: string; options: Partial<OptionType> }>,
  ): Middleware<CtxType, OptionType> {
    return (ctx, options, next) => {
      receivedOptions.push({ scope: "middleware", options });
      return next({ ...ctx, level: ctx.level + 1, options } as CtxType);
    };
  }

  it("propagates options through middleware", () => {
    const receivedOptions: Array<{
      scope: string;
      options: OptionType;
    }> = [];

    const ctx = { level: 0 } as CtxType;
    const resolve = createResolver(optionsCapturingMiddleware(receivedOptions));

    const comp = defineFunctionalComponent<typeof ctx, NoScopeContext, OptionType>();
    const root = comp((a) => a);

    const result = resolve(root, ctx);

    // Middleware is called with empty options on root level
    expect(receivedOptions).toEqual([]);

    // First run with options
    result.run({ action: "fetch" }, (secondLevel) => {
      expect(receivedOptions).toEqual([{ scope: "middleware", options: { action: "fetch" } }]);

      // Nested run with different options
      secondLevel.run({ action: "update" }, (_thirdLevel) => {
        expect(receivedOptions).toEqual([
          { scope: "middleware", options: { action: "fetch" } },
          { scope: "middleware", options: { action: "update" } },
        ]);
      });
    });

    // Another run with different options
    result.run({ action: "delete" }, (_secondLevel) => {
      expect(receivedOptions).toEqual([
        { scope: "middleware", options: { action: "fetch" } },
        { scope: "middleware", options: { action: "update" } },
        { scope: "middleware", options: { action: "delete" } },
      ]);
    });
  });

  it("makes options available in dependency factories", () => {
    const receivedOptions: Array<{
      component: string;
      options: OptionType | undefined;
    }> = [];
    const middlewareOptions: Array<{ scope: string; options: OptionType }> = [];

    const ctx = { level: 0 } as CtxType;
    const resolve = createResolver(optionsCapturingMiddleware(middlewareOptions));
    const comp = defineFunctionalComponent<typeof ctx, NoScopeContext, OptionType>();
    const repo = comp((a) => {
      receivedOptions.push({ component: "repo", options: a.options });
      return a;
    });
    const root = comp(
      (a) => {
        receivedOptions.push({ component: "root", options: a.options });
        return a;
      },
      { repo },
    );

    const result = resolve(root, ctx);

    // Access repo at root level (no options)
    void result.repo;

    // Run with options
    result.run({ action: "fetch" }, async (secondLevel) => {
      void secondLevel.repo;
      secondLevel.run({ action: "update" }, async (thirdLevel) => {
        void thirdLevel.repo;
      });
    });

    expect(receivedOptions).toEqual([
      { component: "root", options: undefined },
      { component: "repo", options: undefined },
      { component: "repo", options: { action: "fetch" } },
      { component: "repo", options: { action: "update" } },
    ]);
  });
});
