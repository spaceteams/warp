# @spaceteams/warp-otel

OpenTelemetry middleware for the [warp](https://github.com/spaceteams/warp) composition runtime — automatic tracing and metrics for every component execution scope.

## Motivation

In a composition runtime like warp, each request resolves a graph of components. Understanding latency, error rates, and call relationships across those components is critical for production debugging and performance tuning. `@spaceteams/warp-otel` wraps each component execution in an OpenTelemetry span and records metrics (run count, errors, duration) automatically, so you get distributed tracing and per-component observability without manual instrumentation.

## Installation

```bash
pnpm add @spaceteams/warp-otel @opentelemetry/api
```

Both `@spaceteams/warp` and `@opentelemetry/api` are peer dependencies.

## Usage

### Basic setup

```ts
import { otel } from "@spaceteams/warp-otel";

const otelMiddleware = otel({
  instrumentationName: "my-service",
});
```

Register it as middleware in your warp runtime. Tracing and metrics are enabled by default.

### Per-component options

Pass `otel` in run options to customize span name and attributes per component:

```ts
const result = await run(context, {
  otel: {
    spanName: "resolve-user-profile",
    attributes: { userId: "abc-123" },
  },
});
```

If no `spanName` is provided, the middleware uses the component's `componentPath` from warp metadata (e.g. `"app.userService.getProfile"`).

### Accessing the span

The middleware injects the active `Span` into the scope context. Downstream code can access it via `OtelScopeContext`:

```ts
import type { OtelScopeContext } from "@spaceteams/warp-otel";

function myComponent(ctx: MyContext & OtelScopeContext) {
  ctx.span?.addEvent("cache-miss");
  ctx.span?.setAttribute("cache.key", key);
  // ...
}
```

### Metrics

When metrics are enabled (default), the middleware automatically records:

| Metric | Type | Description |
|--------|------|-------------|
| `warp.run.count` | Counter | Number of completed component executions |
| `warp.run.errors` | Counter | Number of failed component executions |
| `warp.run.duration` | Histogram (ms) | Duration of each component execution |

Metric names are configurable via `metricNames`. Attributes default to the span attributes (`componentPath`, `componentKind`, `componentName`) but can be overridden with `metricAttributes`.

### Configuration

`OtelMiddlewareConfig` options:

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

Per-run options (`OtelRunOptions`):

| Option | Type | Description |
|--------|------|-------------|
| `otel.spanName` | `string` | Override the span name for this execution |
| `otel.attributes` | `Attributes` | Additional span/metric attributes |
| `otel.recordMetrics` | `boolean` | Override metric recording for this execution |
| `otel.recordErrors` | `boolean` | Override error recording for this execution |

## API

```ts
// Main factory
export function otel<AmbientContext, RunOptions>(
  config: OtelMiddlewareConfig<AmbientContext, RunOptions>,
): Middleware<AmbientContext, RunOptions, OtelScopeContext>;

// Types
export type OtelMiddlewareConfig<AmbientContext, RunOptions>;
export type OtelRunOptions;
export type OtelAmbientContext;
export type OtelScopeContext;
```

## License

MIT
