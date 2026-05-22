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

Retry a component up to 3 times with exponential backoff:

```ts
import { component, resolve } from "@spaceteams/warp";
import { resilience } from "@spaceteams/warp-retry";

const service = component(fetchUser, {}, {
  middleware: [resilience()],
  options: {
    resilience: {
      retry: { maxAttempts: 3 },
    },
  },
});
```

Custom backoff:

```ts
import { ConstantBackoff } from "cockatiel";

options: {
  resilience: {
    retry: { maxAttempts: 5, backoff: new ConstantBackoff(500) },
  },
}
```

### Timeout

Apply a per-attempt timeout of 2 seconds:

```ts
options: {
  resilience: {
    timeout: { duration: 2000 },
  },
}
```

By default the timeout strategy is `Aggressive` — the call rejects immediately when the deadline expires. Use `TimeoutStrategy.Cooperative` if your function checks a cancellation token instead.

### Circuit Breaker

A circuit breaker must be created **outside** the middleware and shared across calls so it can track failure state over time:

```ts
import { resilience, createCircuitBreaker } from "@spaceteams/warp-retry";
import { ConsecutiveBreaker } from "cockatiel";

const breaker = createCircuitBreaker({
  breaker: new ConsecutiveBreaker(5),
  halfOpenAfter: 10_000,
});

const service = component(fetchUser, {}, {
  middleware: [resilience()],
  options: {
    resilience: {
      circuitBreaker: breaker,
    },
  },
});
```

### Composing policies

When all three are configured, the execution order is:

```
retry → circuit breaker → timeout → action
```

This means each retry attempt checks the circuit breaker first, and each attempt has its own timeout.

```ts
import { resilience, createCircuitBreaker } from "@spaceteams/warp-retry";
import { ConsecutiveBreaker, ExponentialBackoff } from "cockatiel";

const breaker = createCircuitBreaker({
  breaker: new ConsecutiveBreaker(5),
  halfOpenAfter: 10_000,
});

const service = component(fetchUser, {}, {
  middleware: [resilience()],
  options: {
    resilience: {
      retry: {
        maxAttempts: 3,
        backoff: new ExponentialBackoff(),
      },
      timeout: { duration: 2000 },
      circuitBreaker: breaker,
    },
  },
});
```

---

## API

### `resilience<Ctx>()`

Returns a warp `Middleware<Ctx, ResilienceOptions>`. Attach it to any component to apply resilience policies.

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

---

## License

MIT
