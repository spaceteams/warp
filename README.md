# 🧵 Warp Monorepo
> Compose once. Resolve per request.

This is the monorepo for the warp library and related packages.

---

## Repo Structure

### [`@spaceteams/warp`](./warp)
The core package containing the runtime and dependency graph dsl.

### [`@spaceteams/examples`](./examples)
A package containing examples written as unit tests.

### [`@spaceteams/warp-pino`](./middleware/pino)
Pino logger middleware — child loggers with component-specific bindings.

### [`@spaceteams/warp-otel`](./middleware/otel)
OpenTelemetry middleware — automatic tracing and metrics per component.

### [`@spaceteams/warp-als`](./middleware/als)
AsyncLocalStorage middleware — expose warp context to legacy code.

### [`@spaceteams/warp-retry`](./middleware/retry)
Resilience middleware — retry, timeout, and circuit breaker powered by cockatiel.
