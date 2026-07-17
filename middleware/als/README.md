# @spaceteams/warp-als

> AsyncLocalStorage middleware for warp — expose context to legacy code.

Bridges warp's explicit context into Node.js `AsyncLocalStorage`, making request-scoped values accessible from code that can't receive parameters directly.

---

## Motivation

Warp passes context explicitly through function parameters — but not every piece of code can receive it that way. Express middleware, ORM hooks, logging libraries, and other framework internals often rely on implicit ambient context. `@spaceteams/warp-als` bridges this gap by exposing selected parts of the warp context via `AsyncLocalStorage`, making them accessible anywhere in the async call chain.

---

## Installation

```bash
pnpm add @spaceteams/warp-als
```

Peer dependency: `@spaceteams/warp`

---

## Usage

### Creating the ALS bridge

Call `createWarpAls` with your context and exposed-context types:

```ts
import { createWarpAls, type AlsOptions } from "@spaceteams/warp-als";

type AppContext = { requestId: string; userId: string; db: Database };
type ExposedContext = { requestId: string; userId: string };

const { middleware, getCtx } = createWarpAls<AppContext, ExposedContext>();
```

### Registering the middleware

```ts
import { buildRuntime, callable } from "@spaceteams/warp";

const { resolve, component } = buildRuntime()
  .use(middleware())
  .provide({ db: createDb() })
  .require<{ requestId: string; userId: string }>();
```

### Declaring the extract function per component

Pass `als` in the callable/usecase meta with an `extract` function that selects the context slice to expose:

```ts
type RunOptions = Partial<AlsOptions<AppContext, ExposedContext>>;

const createOrder = callable<AppContext, [string], Order, RunOptions>(
  {
    name: "create-order",
    als: { extract: (ctx) => ({ requestId: ctx.requestId, userId: ctx.userId }) },
  },
  (ctx) => async (productId) => {
    const order = await ctx.db.insertOrder(productId);
    legacyAuditLog("order-created"); // can access context via getCtx()
    return order;
  },
);
```

Components without `als` in their meta pass through unchanged — the middleware is a no-op.

### Accessing context from anywhere

Call `getCtx()` from any code running within the async scope:

```ts
function legacyAuditLog(action: string) {
  const ctx = getCtx();
  if (ctx) {
    logger.info({ requestId: ctx.requestId, userId: ctx.userId, action });
  }
}
```

`getCtx()` returns `undefined` outside of a warp component scope.

---

## API

### `createWarpAls<Ctx, ExposedCtx>()`

Creates a scoped ALS instance. Returns:

| Member | Type | Description |
|--------|------|-------------|
| `middleware()` | `Middleware<Ctx, AlsOptions<Ctx, ExposedCtx>>` | Warp middleware — register with `.use(middleware())` |
| `getCtx()` | `() => ExposedCtx \| undefined` | Retrieves the stored context for the current async scope |

### `AlsOptions<Ctx, ExposedCtx>`

```ts
type AlsOptions<Ctx, ExposedCtx> = {
  als: {
    extract: (ctx: Ctx) => ExposedCtx;
  };
};
```

RunOptions shape. The `extract` function selects which parts of `Ctx` to expose via AsyncLocalStorage.

---

## License

MIT
