import { describe, expect, it, vi } from "vitest";
import type { Middleware } from "../middleware";
import type { WarpMeta } from "../run";
import { RuntimeBuilder } from "./runtime-builder";

function levelMiddleware(): Middleware<{ level: number }> {
  return (ctx, _options, next) => next({ level: ctx.level + 1 });
}

function warpCapturingMiddleware(
  receivedWarps: Array<WarpMeta | undefined>,
): Middleware<NonNullable<unknown>> {
  return (_ctx, _options, next, warp) => {
    receivedWarps.push(warp);
    return next({});
  };
}

describe("runtime-builder", () => {
  it("registers context", async () => {
    const onCreate = vi.fn();
    const { component, resolve } = new RuntimeBuilder().provide({ context: "1" });
    await resolve(
      component(
        (a) => {
          onCreate(a);
          return a;
        },
        [],
        { kind: "client", name: "name", tags: ["a", "b"] },
      ),
    );
    expect(onCreate).toHaveBeenCalledWith({
      context: "1",
      run: expect.anything(),
      warp: {
        component: {
          kind: "client",
          name: "name",
          tags: ["a", "b"],
        },
      },
    });
  });

  it("registers middleware", async () => {
    const { component, resolve } = new RuntimeBuilder()
      .use(levelMiddleware())
      .provide({ level: 0 });
    const request = await resolve(
      component((a) => a, [], { kind: "service", name: "name", tags: ["a", "b"] }),
    );
    expect(request.level).toEqual(0);

    request.run({}, async ({ level, warp }) => {
      expect(level).toEqual(1);
      expect(warp).toEqual({ component: { kind: "service", name: "name", tags: ["a", "b"] } });
    });
  });

  it("forwards warp meta through composed middleware", async () => {
    const receivedWarps: Array<WarpMeta | undefined> = [];
    const { component, resolve } = new RuntimeBuilder()
      .use(warpCapturingMiddleware(receivedWarps))
      .provide({});

    const request = await resolve(
      component((a) => a, [], { kind: "service", name: "test-service" }),
    );

    // Root resolution does not call middleware (only ctx.run does)
    expect(receivedWarps).toEqual([]);

    await request.run({}, async (inner) => {
      expect(inner.warp).toEqual({ component: { kind: "service", name: "test-service" } });
    });

    // After run, middleware was called once with the root warp meta
    expect(receivedWarps).toEqual([{ component: { kind: "service", name: "test-service" } }]);
  });

  it("forwards warp meta through multiple middlewares", async () => {
    const receivedWarps1: Array<WarpMeta | undefined> = [];
    const receivedWarps2: Array<WarpMeta | undefined> = [];

    const mw1 = (
      _ctx: unknown,
      _options: unknown,
      next: (ctx: unknown) => unknown,
      warp?: WarpMeta,
    ) => {
      receivedWarps1.push(warp);
      return next({});
    };
    const mw2 = (
      _ctx: unknown,
      _options: unknown,
      next: (ctx: unknown) => unknown,
      warp?: WarpMeta,
    ) => {
      receivedWarps2.push(warp);
      return next({});
    };

    const { component, resolve } = new RuntimeBuilder()
      .use(mw1 as Middleware<NonNullable<unknown>>)
      .use(mw2 as Middleware<NonNullable<unknown>>)
      .provide({});

    const request = await resolve(
      component((a) => a, [], { kind: "usecase", name: "test-usecase" }),
    );

    await request.run({}, async () => {});

    // Both middlewares should receive the same warp meta
    expect(receivedWarps1).toEqual([{ component: { kind: "usecase", name: "test-usecase" } }]);
    expect(receivedWarps2).toEqual([{ component: { kind: "usecase", name: "test-usecase" } }]);
  });

  it("forwards warp meta even when component has no explicit meta", async () => {
    const receivedWarps: Array<WarpMeta | undefined> = [];
    const { component, resolve } = new RuntimeBuilder()
      .use(warpCapturingMiddleware(receivedWarps))
      .provide({});

    const request = await resolve(component((a) => a));

    await request.run({}, async () => {});

    // defineFunctionalComponent always assigns a meta object (with undefined fields when not provided)
    expect(receivedWarps).toEqual([
      { component: { kind: undefined, name: undefined, tags: undefined } },
    ]);
  });
});
