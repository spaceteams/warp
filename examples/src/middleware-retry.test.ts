import { buildRuntime, callable } from "@spaceteams/warp";
import {
  ConsecutiveBreaker,
  ConstantBackoff,
  createCircuitBreaker,
  type ResilienceOptions,
  resilience,
} from "@spaceteams/warp-retry";
import { describe, expect, it } from "vitest";

// Resilience middleware example — retry, timeout, circuit breaker
//
// Shows how to protect components against transient failures using
// `@spaceteams/warp-retry`. The middleware is powered by cockatiel and
// applies policies in the order: retry → circuit breaker → timeout → action.
//
// Key points:
// - Register the middleware on the runtime with `.use(resilience())`.
// - Declare per-component options (retry, timeout, circuitBreaker) in the
//   callable/usecase meta — each component gets its own policy.
// - A circuit breaker must be created externally and shared so it can track
//   failure state across calls.

// --- Retry with backoff ---

describe("retry", () => {
  const { resolve, component } = buildRuntime().use(resilience()).provide({});

  it("retries on transient failure", async () => {
    let attempts = 0;

    const flakyFetch = callable<NonNullable<unknown>, [string], string, Partial<ResilienceOptions>>(
      {
        name: "flaky-fetch",
        retry: { maxAttempts: 3, backoff: new ConstantBackoff(0) },
      },
      () => async (url) => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`attempt ${attempts} failed`);
        }
        return `response from ${url}`;
      },
    );

    const fetch = await resolve(component(flakyFetch));
    expect(await fetch("/api/data")).toBe("response from /api/data");
    expect(attempts).toBe(3);
  });

  it("throws after exhausting retries", async () => {
    const alwaysFails = callable<NonNullable<unknown>, [], string, Partial<ResilienceOptions>>(
      {
        name: "always-fails",
        retry: { maxAttempts: 2, backoff: new ConstantBackoff(0) },
      },
      () => async () => {
        throw new Error("permanent failure");
      },
    );

    const doIt = await resolve(component(alwaysFails));
    await expect(doIt()).rejects.toThrow("permanent failure");
  });
});

// --- Timeout ---

describe("timeout", () => {
  const { resolve, component } = buildRuntime().use(resilience()).provide({});

  it("succeeds when call completes in time", async () => {
    const fast = callable<NonNullable<unknown>, [], string, Partial<ResilienceOptions>>(
      { name: "fast-call", timeout: { duration: 1000 } },
      () => async () => "done",
    );

    const result = await resolve(component(fast));
    expect(await result()).toBe("done");
  });

  it("rejects when call exceeds timeout", async () => {
    const slow = callable<NonNullable<unknown>, [], string, Partial<ResilienceOptions>>(
      { name: "slow-call", timeout: { duration: 10 } },
      () => async () => {
        await new Promise((r) => setTimeout(r, 500));
        return "too late";
      },
    );

    const result = await resolve(component(slow));
    await expect(result()).rejects.toThrow();
  });
});

// --- Circuit breaker ---

describe("circuit breaker", () => {
  it("trips after consecutive failures and rejects fast", async () => {
    // The breaker is stateful — create it once and share across calls.
    const breaker = createCircuitBreaker({
      halfOpenAfter: 30_000,
      breaker: new ConsecutiveBreaker(2),
    });

    const { resolve, component } = buildRuntime().use(resilience()).provide({});

    const unreliable = callable<NonNullable<unknown>, [], string, Partial<ResilienceOptions>>(
      { name: "unreliable", circuitBreaker: breaker },
      () => async () => {
        throw new Error("service down");
      },
    );

    const call = await resolve(component(unreliable));

    // First two failures trip the breaker.
    await expect(call()).rejects.toThrow("service down");
    await expect(call()).rejects.toThrow("service down");

    // Circuit is now open — calls are rejected immediately without
    // running the function (BrokenCircuitError).
    await expect(call()).rejects.toThrow();
  });
});

// --- Composing retry + timeout ---

describe("composed policies", () => {
  it("retries timed-out attempts", async () => {
    let attempts = 0;

    const { resolve, component } = buildRuntime().use(resilience()).provide({});

    const resilientFetch = callable<
      NonNullable<unknown>,
      [string],
      string,
      Partial<ResilienceOptions>
    >(
      {
        name: "resilient-fetch",
        retry: { maxAttempts: 3, backoff: new ConstantBackoff(0) },
        timeout: { duration: 50 },
      },
      () => async (url) => {
        attempts++;
        if (attempts === 1) {
          // First attempt times out.
          await new Promise((r) => setTimeout(r, 200));
        }
        return `${url} (attempt ${attempts})`;
      },
    );

    const fetch = await resolve(component(resilientFetch));
    const result = await fetch("/api/users");

    // First attempt timed out, second succeeded.
    expect(result).toBe("/api/users (attempt 2)");
    expect(attempts).toBe(2);
  });
});
