# @spaceteams/warp-retry

> Resilience middleware for warp, powered by [cockatiel](https://github.com/connor4312/cockatiel).

Provides retry, timeout, and circuit breaker policies as composable warp middleware.

---

## Motivation

Distributed systems fail. Network blips, overloaded services, and cold starts cause transient errors that resolve themselves seconds later. Without resilience policies, a single failing dependency can cascade through your entire system.

`@spaceteams/warp-retry` wraps proven resilience patterns (retry with backoff, timeouts, circuit breakers) into a single warp middleware so every component in your graph can declare its failure handling declaratively.

---

## Installation

```bash
pnpm add @spaceteams/warp-retry cockatiel
```

Both `@spaceteams/warp` and `cockatiel` are peer dependencies.

---

## Usage

### Basic retry

Register the middleware on the runtime, then declare retry options per component:

```ts
import { buildRuntime, callable } from "@spaceteams/warp";
import { resilience, ConstantBackoff, type ResilienceOptions } from "@spaceteams/warp-retry";

const runtime = buildRuntime().use(resilience()).provide({ /* your context */ });

const fetchUser = callable<{ db: DB }, [string], User, Partial<ResilienceOptions>>(
  { name: "fetch-user", retry: { maxAttempts: 3 } },
  (ctx) => async (userId) => {
    return ctx.db.findUser(userId);
  },
);

const { resolve, component } = runtime;
const getUser = await resolve(component(fetchUser));
await getUser("user-123"); // retries up to 3 times on failure
```

Custom backoff:

```ts
import { ExponentialBackoff, ConstantBackoff } from "@spaceteams/warp-retry";

const fetchWithBackoff = callable<Context, [string], Data, Partial<ResilienceOptions>>(
  {
    name: "fetch-with-backoff",
    retry: { maxAttempts: 5, backoff: new ConstantBackoff(500) },
  },
  (ctx) => async (url) => { /* ... */ },
);
```

### Timeout

Apply a per-attempt timeout:

```ts
const fetchWithTimeout = callable<Context, [string], Data, Partial<ResilienceOptions>>(
  { name: "fetch-data", timeout: { duration: 2000 } },
  (ctx) => async (url) => { /* ... */ },
);
```

By default the timeout strategy is `Aggressive` — the call rejects immediately when the deadline expires. Use `TimeoutStrategy.Cooperative` if your function checks a cancellation token instead.

### Circuit Breaker

A circuit breaker must be created **outside** the callable and shared across calls so it can track failure state over time:

```ts
import { resilience, createCircuitBreaker, ConsecutiveBreaker, type ResilienceOptions } from "@spaceteams/warp-retry";

const breaker = createCircuitBreaker({
  breaker: new ConsecutiveBreaker(5),
  halfOpenAfter: 10_000,
});

const fetchUser = callable<Context, [string], User, Partial<ResilienceOptions>>(
  { name: "fetch-user", circuitBreaker: breaker },
  (ctx) => async (userId) => { /* ... */ },
);
```

### Composing policies

When all three are configured, the execution order is:

```
retry → circuit breaker → timeout → action
```

This means each retry attempt checks the circuit breaker first, and each attempt has its own timeout.

```ts
import { resilience, createCircuitBreaker, ConsecutiveBreaker, ExponentialBackoff, type ResilienceOptions } from "@spaceteams/warp-retry";

const breaker = createCircuitBreaker({
  breaker: new ConsecutiveBreaker(5),
  halfOpenAfter: 10_000,
});

const resilientFetch = callable<Context, [string], Data, Partial<ResilienceOptions>>(
  {
    name: "resilient-fetch",
    retry: { maxAttempts: 3, backoff: new ExponentialBackoff() },
    timeout: { duration: 2000 },
    circuitBreaker: breaker,
  },
  (ctx) => async (url) => { /* ... */ },
);

const { resolve, component } = buildRuntime().use(resilience()).provide({});
const fetch = await resolve(component(resilientFetch));
await fetch("/api/users");
```

---

## API

### `resilience<Ctx>()`

Returns a warp `Middleware<Ctx, ResilienceOptions>`. Register it with `.use(resilience())` on the runtime.

#### `ResilienceOptions`

| Field | Description |
|-------|-------------|
| `retry.maxAttempts` | Total attempts including the first. Default: `3` |
| `retry.backoff` | Backoff factory (e.g. `ExponentialBackoff`, `ConstantBackoff`). Default: `ExponentialBackoff` |
| `timeout.duration` | Timeout in milliseconds per attempt |
| `timeout.strategy` | `TimeoutStrategy.Aggressive` (default) or `TimeoutStrategy.Cooperative` |
| `circuitBreaker` | A `CircuitBreakerPolicy` instance (see below) |

All fields are optional — only configured policies are applied.

### `createCircuitBreaker(opts)`

Convenience wrapper around cockatiel's `circuitBreaker()`. Accepts `ICircuitBreakerOptions` and returns a `CircuitBreakerPolicy`.

### Re-exports

The package re-exports commonly used cockatiel utilities:

- `ExponentialBackoff`, `ConstantBackoff`
- `ConsecutiveBreaker`, `SamplingBreaker`
- `TimeoutStrategy`
- `handleAll`

---

## License

MIT
