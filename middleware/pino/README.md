# @spaceteams/warp-pino

> Pino logger middleware for warp — child loggers with component-specific bindings.

Automatically creates a [Pino](https://getpino.io/) child logger for each component scope, binding the component name and path into every log line.

---

## Motivation

In component-based architectures, flat log output quickly becomes unusable. `@spaceteams/warp-pino` creates a child logger per component execution, injecting `componentPath` and `component` metadata automatically. This gives you structured, correlated logs without manual logger plumbing.

---

## Installation

```bash
pnpm add @spaceteams/warp-pino pino
```

Both `@spaceteams/warp` and `pino` are peer dependencies.

---

## Usage

### Setting up the middleware

```ts
import { buildRuntime, callable } from "@spaceteams/warp";
import { pino, type LoggingCtx, type LoggingOptions } from "@spaceteams/warp-pino";
import pinoLogger from "pino";

// Register the middleware and provide a root logger.
const { resolve, component } = buildRuntime()
  .use(pino())
  .provide({ logger: pinoLogger() });
```

### Adding bindings per component

Pass `logging` in the callable/usecase meta to attach custom bindings:

```ts
const fetchOrder = callable<LoggingCtx, [string], Order, Partial<LoggingOptions>>(
  {
    name: "fetch-order",
    logging: { bindings: { service: "orders", version: "2.1.0" } },
  },
  (ctx) => async (orderId) => {
    // ctx.logger is a child logger with componentPath, component,
    // service, and version fields bound automatically.
    ctx.logger.info({ orderId }, "fetching order");
    return db.findOrder(orderId);
  },
);
```

Each log line from `ctx.logger` inside this component will include `componentPath`, `component`, `service`, and `version`.

### Custom child logger options

Override the log level or other Pino child options per component:

```ts
const debugHeavy = callable<LoggingCtx, [], void, Partial<LoggingOptions>>(
  {
    name: "debug-heavy",
    logging: {
      bindings: { module: "diagnostics" },
      options: { level: "debug" },
    },
  },
  (ctx) => async () => {
    ctx.logger.debug("verbose output visible even if root level is 'info'");
  },
);
```

### Components without logging options

Components that don't declare `logging` in their meta pass through unchanged — the middleware is a no-op and `ctx.logger` remains the parent logger.

---

## API

### `pino<Ctx, ChildCustomLevels>()`

Returns a warp `Middleware<Ctx, LoggingOptions<ChildCustomLevels>>`. Register it with `.use(pino())` on the runtime.

### `LoggingOptions<ChildCustomLevels>`

```ts
type LoggingOptions<ChildCustomLevels extends string = never> = {
  logging: {
    bindings: Bindings;
    options?: ChildLoggerOptions<ChildCustomLevels>;
  };
};
```

RunOptions shape. `bindings` are merged into the child logger alongside warp metadata; `options` are forwarded to Pino's `.child()` call.

### `LoggingCtx`

```ts
type LoggingCtx = { logger: Logger };
```

Context constraint — your runtime context must include a `logger` field holding a Pino `Logger` instance.

---

## License

MIT
