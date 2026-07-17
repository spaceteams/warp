import { buildRuntime, callable } from "@spaceteams/warp";
import { type AlsOptions, createWarpAls } from "@spaceteams/warp-als";
import { describe, expect, it } from "vitest";

// AsyncLocalStorage middleware example
//
// Shows how to bridge warp's explicit context to code that can't receive it
// as a parameter — legacy libraries, ORM hooks, framework middleware, etc.
//
// Key points:
// - `createWarpAls()` creates an ALS instance scoped to your context type.
// - The `middleware()` runs the component inside `AsyncLocalStorage.run()`.
// - `getCtx()` retrieves the exposed context from anywhere in the async scope.
// - The `extract` function controls which parts of the context are exposed.

// --- Setup ---

// The full context a component sees after resolution.
type FullContext = {
  requestId: string;
  userId: string;
  db: { query: (sql: string) => string };
};

// We only want to expose request metadata to legacy code, not the db handle.
type ExposedContext = {
  requestId: string;
  userId: string;
};

// Create the ALS bridge.
const { middleware: alsMiddleware, getCtx } = createWarpAls<FullContext, ExposedContext>();

// --- Legacy code that uses getCtx() ---

// This function can't receive the warp context directly — it might be called
// from deep inside a library, an ORM hook, or framework middleware.
const auditLog: string[] = [];
function legacyAuditLog(action: string) {
  const ctx = getCtx();
  if (ctx) {
    auditLog.push(`[${ctx.requestId}] user=${ctx.userId} action=${action}`);
  } else {
    auditLog.push(`[no-context] action=${action}`);
  }
}

// --- Warp component that triggers legacy code ---

type AlsRunOptions = AlsOptions<FullContext, ExposedContext>;

const createOrder = callable<FullContext, [string], string, Partial<AlsRunOptions>>(
  {
    name: "create-order",
    als: { extract: (ctx) => ({ requestId: ctx.requestId, userId: ctx.userId }) },
  },
  (ctx) => async (productId) => {
    const result = ctx.db.query(`INSERT order ${productId}`);
    // This call goes through legacy code that uses AsyncLocalStorage.
    legacyAuditLog(`created order for ${productId}`);
    return result;
  },
);

// --- Tests ---

describe("ALS middleware — bridging context to legacy code", () => {
  const runtime = buildRuntime()
    .use(alsMiddleware())
    .provide({ db: { query: (sql: string) => `executed: ${sql}` } })
    .require<{ requestId: string; userId: string }>();

  const { resolve, component } = runtime;

  it("exposes context to legacy code via AsyncLocalStorage", async () => {
    auditLog.length = 0;

    const order = await resolve(component(createOrder), {
      requestId: "req-123",
      userId: "alice",
    });
    await order("widget-42");

    expect(auditLog).toEqual(["[req-123] user=alice action=created order for widget-42"]);
  });

  it("provides different context per request", async () => {
    auditLog.length = 0;

    const order1 = await resolve(component(createOrder), {
      requestId: "req-A",
      userId: "bob",
    });
    const order2 = await resolve(component(createOrder), {
      requestId: "req-B",
      userId: "carol",
    });

    await order1("item-1");
    await order2("item-2");

    expect(auditLog).toEqual([
      "[req-A] user=bob action=created order for item-1",
      "[req-B] user=carol action=created order for item-2",
    ]);
  });

  it("getCtx() returns undefined outside a warp scope", () => {
    // Outside of a resolved component, there's no ALS context.
    expect(getCtx()).toBeUndefined();
  });
});
