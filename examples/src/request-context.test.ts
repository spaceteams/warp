import { buildRuntime, usecase } from "@spaceteams/warp";
import { describe, expect, it } from "vitest";

// Request context example
//
// This builds on the simple-service pattern to show per-request context values.
// The runtime can carry request-scoped values (like `userId` or feature flags)
// which are available to component factories. Tests show how the runtime's
// `.with({...})` can be used to provide defaults and override them per-test.
//
// Key points:
// - Components can be functions that accept the request context and derive
//   behavior from it (e.g. feature flags).
// - When the service doesn't receive an explicit argument it can use a value
//   from the context (e.g. `userId`) — a common pattern for request-level services.
type Ctx = { userId: string; repoFeature: boolean };

const repo = (ctx: Ctx) => (id: string) => {
  if (ctx.repoFeature) {
    return `${id}-special-result`;
  }
  return `${id}-default-result`;
};
type Repo = ReturnType<typeof repo>;

const callWithUserId = usecase<Ctx & { repo: Repo }, [string?], string>(
  { name: "callWithUserId" },
  (ctx) => async (id) => {
    // If no `id` is provided we use the current request user id from context.
    const result = ctx.repo(id ?? ctx.userId);
    return result;
  },
);

describe("request context", () => {
  // Provide a default for repoFeature and require useId. When resolving later, this will
  // be required as an argument.
  const runtime = buildRuntime().provide({ repoFeature: false }).require<{ userId: string }>();

  // Define the component graph using the runtime's component helper.
  const { component } = runtime;
  const graph = component(callWithUserId, { repo: component(repo) });

  it("can be explained", () => {
    expect(runtime.explain(graph, "ascii", true)).toMatchInlineSnapshot(`
      "└── callWithUserId [usecase]
          └── repo"
    `);
  });

  it("reads argument", async () => {
    // Resolve the service with an explicit userId argument. This
    // would be done on a per request basis, providing just the
    // required request context.
    const usecaseInstance = await runtime.resolve(graph, { userId: "" });
    expect(await usecaseInstance("my-user")).toEqual("my-user-default-result");
  });

  it("reads userId and feature flag from context", async () => {
    // This time the repo factory sees `repoFeature: true` and returns the
    // "special" result, and calling the service without an id falls back to
    // `userId` from the runtime context. Using provide we can override this
    // on the runtime level.
    const specialRequestRuntime = runtime.provide({ repoFeature: true });
    const usecaseInstance = await specialRequestRuntime.resolve(graph, {
      userId: "current-user",
    });
    expect(await usecaseInstance()).toEqual("current-user-special-result");
  });
});
