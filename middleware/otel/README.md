# @spaceteams/warp-otel

> OpenTelemetry middleware for warp — automatic tracing and metrics per component.

Wraps each component execution in an OpenTelemetry span and records run count, errors, and duration metrics automatically.

---

## Motivation

In a composition runtime like warp, each request resolves a graph of components. Understanding latency, error rates, and call relationships across those components is critical for production debugging and performance tuning. `@spaceteams/warp-otel` gives you distributed tracing and per-component observability without manual instrumentation.

---

## Installation

```bash
pnpm add @spaceteams/warp-otel @opentelemetry/api
```

Both `@spaceteams/warp` and `@opentelemetry/api` are peer dependencies.

---

## Usage

### Basic setup

```ts
import { buildRuntime, usecase } from "@spaceteams/warp";
import { otel, type OtelRunOptions } from "@spaceteams/warp-otel";

const { resolve, component } = buildRuntime()
  .use(otel({ instrumentationName: "my-service" }))
  .provide({});
```

Tracing and metrics are enabled by default for any component that declares `otel` in its meta.

### Per-component options

Declare `otel` in the callable/usecase meta to enable instrumentation:

```ts
const fetchProfile = usecase<Context, [string], Profile, Partial<OtelRunOptions>>(
  {
    name: "fetch-profile",
    otel: {
      spanName: "resolve-user-profile",
      attributes: { "app.module": "users" },
    },
  },
  (ctx) => async (userId) => {
    return ctx.profileRepo.find(userId);
  },
);
```

If no `spanName` is provided, the middleware uses the component's `componentPath` from warp metadata. Components without `otel` in their meta are not instrumented.

### Accessing the span

The middleware injects the active `Span` into the scope context. Downstream code can access it:

```ts
import type { OtelScopeContext } from "@spaceteams/warp-otel";

const processOrder = callable<Context & OtelScopeContext, [string], void, Partial<OtelRunOptions>>(
  { name: "process-order", otel: {} },
  (ctx) => async (orderId) => {
    ctx.span?.addEvent("processing-started");
    ctx.span?.setAttribute("order.id", orderId);
    // ...
  },
);
```

### Metrics

When metrics are enabled (default), the middleware records:

| Metric | Type | Description |
|--------|------|-------------|
| `warp.run.count` | Counter | Number of completed component executions |
| `warp.run.errors` | Counter | Number of failed component executions |
| `warp.run.duration` | Histogram (ms) | Duration of each component execution |

Metric names are configurable via `metricNames` in the middleware config.

---

## Configuration

### `otel(config)`

Returns a warp middleware. Register with `.use(otel(config))`.

#### `OtelMiddlewareConfig`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `instrumentationName` | `string` | **(required)** | Name passed to the OTel tracer/meter |
| `instrumentationVersion` | `string` | `undefined` | Version passed to the OTel tracer/meter |
| `tracing` | `boolean` | `true` | Enable span creation |
| `metrics` | `boolean` | `true` | Enable metric recording |
| `recordErrors` | `boolean` | `true` | Record exceptions on spans on error |
| `tracer` | `Tracer` | auto-resolved | Custom OTel tracer instance |
| `meter` | `Meter` | auto-resolved | Custom OTel meter instance |
| `metricNames` | `{ runs?, errors?, duration? }` | see above | Override default metric names |
| `metricAttributes` | `(ctx, options, outcome) => Attributes` | span attributes | Custom metric attribute function |

#### `OtelRunOptions` (per-component)

| Option | Type | Description |
|--------|------|-------------|
| `otel.spanName` | `string` | Override the span name for this component |
| `otel.attributes` | `Attributes` | Additional span/metric attributes |
| `otel.recordMetrics` | `boolean` | Override metric recording for this component |
| `otel.recordErrors` | `boolean` | Override error recording for this component |

### Exported types

```ts
export type OtelMiddlewareConfig<AmbientContext, RunOptions>;
export type OtelRunOptions;
export type OtelAmbientContext;  // { otel?: { parentContext?: Context } }
export type OtelScopeContext;    // { span?: Span }
```

---

## License

MIT
