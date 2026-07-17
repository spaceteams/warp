import { buildRuntime, callable, type InferRepo, repo } from "@spaceteams/warp";
import { describe, expect, it } from "vitest";

// Multi-tenant callable example
//
// Shows how `callable` works and how moving a value from explicit arguments
// into context can simplify call sites when multiple components share the
// same dependency.
//
// Key points:
// - `callable` is the low-level primitive behind `usecase`. Use it when you
//   don't need the "usecase" semantic label.
// - Moving `tenantId` from arguments into context means every component in
//   the graph sees it automatically — no manual threading.
// - `.require<{ tenantId: string }>()` declares that `tenantId` must be
//   supplied at resolve time.

// --- Phase 1: tenantId as an explicit argument ---

type BaseContext = {
  logger: (msg: string) => void;
};

const tenantRepo = repo({ name: "tenant-repo" }, () => (tenantId: string) => ({
  id: tenantId,
  plan: tenantId === "acme" ? ("enterprise" as const) : ("starter" as const),
}));
type TenantRepo = InferRepo<typeof tenantRepo>;

const getRateLimit = callable<BaseContext & { tenantRepo: TenantRepo }, [string], number>(
  { name: "get-rate-limit" },
  (ctx) => async (tenantId) => {
    const tenant = ctx.tenantRepo(tenantId);
    ctx.logger(`rate-limit lookup for tenant ${tenant.id} (${tenant.plan})`);
    return tenant.plan === "enterprise" ? 10_000 : 100;
  },
);

describe("callable — tenantId as argument", () => {
  const logs: string[] = [];
  const { resolve, component } = buildRuntime().provide({
    logger: (msg: string) => logs.push(msg),
  });

  const graph = component(getRateLimit, {
    tenantRepo: component(tenantRepo),
  });

  it("returns enterprise rate limit", async () => {
    logs.length = 0;
    const rateLimit = await resolve(graph);
    expect(await rateLimit("acme")).toBe(10_000);
    expect(logs).toEqual(["rate-limit lookup for tenant acme (enterprise)"]);
  });

  it("returns starter rate limit", async () => {
    logs.length = 0;
    const rateLimit = await resolve(graph);
    expect(await rateLimit("small-co")).toBe(100);
    expect(logs).toEqual(["rate-limit lookup for tenant small-co (starter)"]);
  });
});

// --- Phase 2: tenantId moved into context ---
//
// When multiple components need tenantId, passing it as an argument to each
// one becomes repetitive. Moving it into the context means it's supplied once
// at resolve time and every component in the graph can access it.

type TenantContext = BaseContext & { tenantId: string };

const tenantRepoCtx = repo({ name: "tenant-repo" }, (ctx: TenantContext) => () => ({
  id: ctx.tenantId,
  plan: ctx.tenantId === "acme" ? ("enterprise" as const) : ("starter" as const),
}));
type TenantRepoCtx = InferRepo<typeof tenantRepoCtx>;

const getRateLimitCtx = callable<TenantContext & { tenantRepo: TenantRepoCtx }, [], number>(
  { name: "get-rate-limit" },
  (ctx) => async () => {
    const tenant = ctx.tenantRepo();
    ctx.logger(`rate-limit lookup for tenant ${tenant.id} (${tenant.plan})`);
    return tenant.plan === "enterprise" ? 10_000 : 100;
  },
);

describe("callable — tenantId in context", () => {
  const logs: string[] = [];
  const runtime = buildRuntime()
    .provide({ logger: (msg: string) => logs.push(msg) })
    .require<{ tenantId: string }>();

  const { resolve, component, explain } = runtime;

  const graph = component(getRateLimitCtx, {
    tenantRepo: component(tenantRepoCtx),
  });

  it("can be explained", () => {
    expect(explain(graph, "ascii", true)).toMatchInlineSnapshot(`
      "└── get-rate-limit
          └── tenantRepo -> tenant-repo [repo]"
    `);
  });

  it("resolves with enterprise tenant", async () => {
    logs.length = 0;
    const rateLimit = await resolve(graph, { tenantId: "acme" });
    expect(await rateLimit()).toBe(10_000);
    expect(logs).toEqual(["rate-limit lookup for tenant acme (enterprise)"]);
  });

  it("resolves with starter tenant", async () => {
    logs.length = 0;
    const rateLimit = await resolve(graph, { tenantId: "small-co" });
    expect(await rateLimit()).toBe(100);
    expect(logs).toEqual(["rate-limit lookup for tenant small-co (starter)"]);
  });
});
