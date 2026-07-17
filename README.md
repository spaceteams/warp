# 🧵 Warp
> Compose once. Resolve per request.

`warp` is a small runtime for composing application components and resolving them
against an ambient context.

It helps structure repositories, services and use cases as an explicit dependency
graph while keeping request context, transactions, tracing and tests easy to manage.

No container magic. No autowiring. Just explicit composition and scoped execution.

---

## The problem

In most Node.js applications, wiring dependencies eventually becomes messy.

You end up with one of these situations:

- **Manual wiring everywhere**
```ts
const repo = createRepo(prisma)
const service = createService(repo)
const usecase = createUseCase(service)
```
- **A container that hides everything**
```ts
container.resolve("CreateUserUseCase")
```

Manual wiring becomes repetitive.
Containers often introduce hidden magic and runtime errors.

At the same time modern applications need:

- request scoped context
- transactions
- tracing and metrics
- easy test overrides

warp provides a middle ground.

Dependencies stay explicit and typed, but wiring happens once and the runtime handles scoped execution.

## Core idea

Define a *component graph* once:
```ts
const service = component(serviceFactory, {
  repo: component(repoFactory)
})
```
Resolve it against the *current request context*:
```ts
const handler = resolve(service, { requestId })
handler(params)
```
The graph is static.
The context is supplied when executing.

> Compose once, resolve per request.

## Why warp?

- explicit dependency graphs
- typed context
- request-scoped execution
- middleware for cross-cutting concerns
- easy testing with overrides
- no container magic

## Getting started

Install the core package:

```sh
npm install @spaceteams/warp
```

Then check out the [examples](./examples/src/) — they are self-contained test files
that walk you through the library step by step, from basic composition to
middleware and testing patterns.

## When to use it

`warp` is useful if your application has:

- repositories, services and use cases
- request scoped context
- transactions or tracing
- complex dependency wiring
- tests that need to replace dependencies

## When not to use it

If your application is small and simple manual wiring is enough, you probably don't need `warp`.

Or if you want to go all-in with [effect](https://effect.website/) anyway.

---

## Packages

### [`@spaceteams/warp`](./warp)
The core package — runtime, dependency graph DSL, and semantic helpers
(`usecase`, `callable`, `repo`, `service`, `client`).

### [`@spaceteams/warp-examples`](./examples)
Runnable examples written as vitest files — the best place to learn the library.
See the [examples README](./examples/src/README.md) for an overview.

### Middleware

| Package | Description |
| ------- | ----------- |
| [`@spaceteams/warp-pino`](./middleware/pino) | Pino logger middleware — child loggers with component-specific bindings. |
| [`@spaceteams/warp-otel`](./middleware/otel) | OpenTelemetry middleware — automatic tracing and metrics per component. |
| [`@spaceteams/warp-als`](./middleware/als) | AsyncLocalStorage middleware — expose warp context to legacy code. |
| [`@spaceteams/warp-retry`](./middleware/retry) | Resilience middleware — retry, timeout, and circuit breaker powered by cockatiel. |

## Status

Early stage, evolving API.
