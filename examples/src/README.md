# warp Examples

A curated set of examples showing how to use warp's dependency injection primitives — from basic composition to middleware and testing patterns. Each example builds on the previous ones, so working through them in order is a great way to learn the library.

## Getting Started

| Example | Description |
| ------- | ----------- |
| [simple-service.test.ts](./simple-service.test.ts) | **Simple service composition** — The simplest starting point. Shows how to compose a service with a repository dependency using `component()` and `resolve()`. Start here if you're new to warp. |
| [request-context.test.ts](./request-context.test.ts) | **Per-request context** — Shows how to use `.provide()` and `.require<>()` to inject request-scoped values (like `userId` or feature flags) into the component graph. |
| [callable-multi-tenant.test.ts](./callable-multi-tenant.test.ts) | **Callable & context extraction** — Demonstrates `callable` (the low-level building block behind `usecase`) in a multi-tenant scenario. Shows the progression from passing `tenantId` as an explicit argument to moving it into context so all components share it automatically. |

## Patterns

| Example | Description |
| ------- | ----------- |
| [combine-modules.test.ts](./combine-modules.test.ts) | **Bundling into modules** — Uses `combine()` to group related operations (find, create, deactivate) into a single component that can be wired as a unit. Also shows how context requirements are intersected automatically. |
| [realistic-usecase.test.ts](./realistic-usecase.test.ts) | **Realistic usecase** — A more complete example combining class-based components, typed context, repos, services, and usecases. Shows `explain()` for visualizing the dependency graph. |
| [lazy-heavy-dependency.test.ts](./lazy-heavy-dependency.test.ts) | **Lazy instantiation** — Shows how expensive dependencies (e.g. PDF clients) are only created when actually accessed, using `provideLazy()`. |
| [singelton.test.ts](./singelton.test.ts) | **Singleton components** — Demonstrates how `singleton()` caches a component instance across the graph and even across multiple resolves. |
| [test-overrides.test.ts](./test-overrides.test.ts) | **Test overrides** — Shows how to inject a fake or mock by passing a plain value instead of a component factory. |

## Middleware

| Example | Description |
| ------- | ----------- |
| [middleware-retry.test.ts](./middleware-retry.test.ts) | **Resilience (retry, timeout, circuit breaker)** — Uses `@spaceteams/warp-retry` to add retry with backoff, per-call timeouts, and a shared circuit breaker to components. |
| [middleware-als.test.ts](./middleware-als.test.ts) | **AsyncLocalStorage bridge** — Uses `@spaceteams/warp-als` to expose request-scoped context to legacy code that can't receive warp parameters directly. |
| [tracing-metrics.test.ts](./tracing-metrics.test.ts) | **Tracing & metrics** — Shows how to use `.use()` to register middleware and `ctx.run()` for nested scopes with span tracking. |
| [transactions.test.ts](./transactions.test.ts) | **Transactions** — Shows how middleware can modify the context per scope to simulate database transactions with different isolation levels. |

---

Each example is a self-contained [Vitest](https://vitest.dev/) file. Run them all from the `examples` directory with:

```sh
pnpm test
```
