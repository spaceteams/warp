import { buildRuntime, type Middleware, type NoScopeContext, type Run } from "@spaceteams/warp";
import { describe, expect, it } from "vitest";

// Transactions example
//
// Here we show how you can work with transactions by simulating them in a test middleware.
// Key ideas:
// - Middleware can return a modified context to simulate resource scoping.
// - `ctx.run({ isolation: "serializable" }, callback)` creates a nested run
//   with the middleware receiving the provided options, allowing the middleware
//   to adjust the context for that nested scope.
// - Inner operations see the modified `db` client while outer operations keep
//   the original `db` context.
type TxOptions = { isolation?: string };
type Ctx = {
  db: { txLabel: string };
};
function transaction(): Middleware<Ctx, TxOptions> {
  return (ctx, options, next) =>
    // this middleware simulates that we open a transaction and replace the db client
    next({
      ...ctx,
      db: { txLabel: options.isolation ?? ctx.db.txLabel },
    });
}

const orderRepo = (ctx: Ctx) => ({
  save: (orderId: string) => `order:${orderId}@${ctx.db.txLabel}`,
});

const inventoryRepo = (ctx: Ctx) => ({
  reserve: (sku: string) => `reserve:${sku}@${ctx.db.txLabel}`,
});

type Deps = {
  orderRepo: ReturnType<typeof orderRepo>;
  inventoryRepo: ReturnType<typeof inventoryRepo>;
};

const checkout = (ctx: Run<Ctx & Deps, NoScopeContext, TxOptions>) => async () => {
  // The outer step uses the outer DB client.
  const outerStep = ctx.orderRepo.save("o-1");
  // Inner run requests a different isolation level and thus receives a modified db.
  const innerSteps = await ctx.run({ isolation: "serializable" }, async (inner) => {
    const step1 = inner.orderRepo.save("o-2");
    const step2 = inner.inventoryRepo.reserve("sku-1");
    return [step1, step2];
  });
  return [outerStep, ...innerSteps];
};

describe("transactions", async () => {
  const { resolve, component } = buildRuntime()
    .use(transaction())
    .provide({ db: { txLabel: "none" } });

  it("applies isolation levels per scope as requested", async () => {
    const instance = await resolve(
      component(checkout, {
        orderRepo: component(orderRepo),
        inventoryRepo: component(inventoryRepo),
      }),
    );
    expect(await instance()).toEqual([
      "order:o-1@none",
      "order:o-2@serializable",
      "reserve:sku-1@serializable",
    ]);
  });
});
