# @spaceteams/warp-pino

Pino logger middleware for the warp composition runtime — creates child loggers with component-specific bindings for each execution scope.

## Motivation

In component-based architectures, flat log output quickly becomes unusable. `@spaceteams/warp-pino` automatically creates a Pino child logger for every component resolution, binding the component name and path into each log line. This gives you structured, correlated logs out of the box — making request tracing and component-level debugging straightforward without manual logger plumbing.

## Installation

```sh
pnpm add @spaceteams/warp-pino pino
```

Both `@spaceteams/warp` and `pino` are peer dependencies.

## Usage

### Setting up the middleware

```typescript
import { createWarp } from "@spaceteams/warp";
import { pino } from "@spaceteams/warp-pino";
import type { LoggingCtx } from "@spaceteams/warp-pino";
import pinoPkg from "pino";

type Ctx = LoggingCtx & {
  // your additional context fields
};

const warp = createWarp<Ctx>({
  middlewares: [pino()],
  context: {
    logger: pinoPkg(), // root logger
  },
});
```

### Adding bindings per component

Pass `logging` options when defining a component to attach custom bindings to its child logger:

```typescript
import type { LoggingOptions } from "@spaceteams/warp-pino";

const myComponent = warp.component<MyOutput, LoggingOptions>(
  "myComponent",
  async (ctx) => {
    ctx.logger.info("resolved with component-specific bindings");
    return { /* ... */ };
  },
  {
    logging: {
      bindings: { service: "billing", version: "1.2.0" },
    },
  },
);
```

Each log line produced by `ctx.logger` inside this component will include `componentPath`, `component`, `service`, and `version` fields automatically.

### Custom child logger options

You can pass Pino `ChildLoggerOptions` to override the log level or other settings per component:

```typescript
const verboseComponent = warp.component<MyOutput, LoggingOptions>(
  "verboseComponent",
  async (ctx) => {
    ctx.logger.debug("this will appear even if root level is 'info'");
    return { /* ... */ };
  },
  {
    logging: {
      bindings: { service: "debug-heavy" },
      options: { level: "debug" },
    },
  },
);
```

## API

### `pino<Ctx, ChildCustomLevels>()`

Returns a warp `Middleware<Ctx, LoggingOptions<ChildCustomLevels>>`. The middleware reads `options.logging` and, when present, creates a child logger from `ctx.logger` with the provided bindings merged with `componentPath` and `component` from the warp runtime metadata.

### `LoggingOptions<ChildCustomLevels>`

```typescript
type LoggingOptions<ChildCustomLevels extends string = never> = {
  logging: {
    bindings: Bindings;
    options?: ChildLoggerOptions<ChildCustomLevels>;
  };
};
```

Options shape expected by the middleware. `bindings` are merged into the child logger; `options` are forwarded to Pino's `.child()` call.

### `LoggingCtx`

```typescript
type LoggingCtx = {
  logger: Logger;
};
```

Context constraint — your warp context must include a `logger` field holding a Pino `Logger` instance.

## License

MIT
