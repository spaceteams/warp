# @spaceteams/warp-als

AsyncLocalStorage middleware for the warp composition runtime.

## Motivation

Warp passes context explicitly through function parameters — but not every piece of code can receive it that way. Express middleware, ORM hooks, logging libraries, and other framework internals often rely on implicit ambient context. `@spaceteams/warp-als` bridges this gap by exposing selected parts of the warp context via Node.js `AsyncLocalStorage`, making them accessible anywhere in the async call chain without threading parameters manually.

## Installation

```bash
pnpm add @spaceteams/warp-als
```

Peer dependency: `@spaceteams/warp`

## Usage

### Creating the ALS bridge

Call `createWarpAls` with your context and exposed-context types. It returns a `middleware` factory and a `getCtx` accessor.

```ts
import { createWarpAls } from "@spaceteams/warp-als";

type MyCtx = { requestId: string; userId: string; db: Database };
type ExposedCtx = { requestId: string; userId: string };

const { middleware, getCtx } = createWarpAls<MyCtx, ExposedCtx>();
```

### Registering the middleware

Add the middleware to your warp runtime like any other middleware:

```ts
import { createRuntime } from "@spaceteams/warp";

const runtime = createRuntime({
  middlewares: [middleware()],
  // ...
});
```

### Configuring the extract function

Pass the `als` option with an `extract` function that selects the context slice you want to expose:

```ts
runtime.resolve(myComponent, {
  als: {
    extract: (ctx) => ({
      requestId: ctx.requestId,
      userId: ctx.userId,
    }),
  },
});
```

If no `als` option is provided, the middleware is a no-op and simply calls `next`.

### Accessing context from anywhere

Call `getCtx()` from any code running within the async scope — no parameter passing required:

```ts
import { getCtx } from "./my-als-bridge";

// Inside an ORM hook, Express middleware, logger, etc.
function auditLog(action: string) {
  const ctx = getCtx();
  if (ctx) {
    logger.info({ requestId: ctx.requestId, userId: ctx.userId, action });
  }
}
```

## API

### `createWarpAls<Ctx, ExposedCtx>()`

Creates a scoped ALS instance. Returns:

| Member | Type | Description |
|--------|------|-------------|
| `middleware()` | `Middleware<Ctx, AlsOptions<Ctx, ExposedCtx>>` | Warp middleware that runs `next` inside `AsyncLocalStorage.run` |
| `getCtx()` | `() => ExposedCtx \| undefined` | Retrieves the stored context for the current async scope |

### `AlsOptions<Ctx, ExposedCtx>`

```ts
type AlsOptions<Ctx, ExposedCtx> = {
  als: {
    extract: (ctx: Ctx) => ExposedCtx;
  };
};
```

Configuration object passed as middleware hints. The `extract` function selects which parts of `Ctx` to expose.

### `AlsCtx`

```ts
type AlsCtx = NonNullable<unknown>;
```

Constraint type ensuring the context is non-nullable.

## License

MIT
