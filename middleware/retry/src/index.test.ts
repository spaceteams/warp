import { describe, expect, it, vi } from "vitest";
import {
  ConsecutiveBreaker,
  ConstantBackoff,
  createCircuitBreaker,
  resilience,
  TimeoutStrategy,
} from ".";

type Ctx = { value: string };
const ctx: Ctx = { value: "test" };

describe("resilience middleware", () => {
  describe("pass-through", () => {
    it("calls next directly when no options are provided", async () => {
      const mw = resilience<Ctx>();
      const next = vi.fn().mockResolvedValue(42);

      const result = await mw(ctx, {}, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(ctx);
      expect(result).toBe(42);
    });
  });

  describe("retry", () => {
    it("retries on transient failure", async () => {
      const mw = resilience<Ctx>();
      const next = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("ok");

      const result = await mw(
        ctx,
        { retry: { maxAttempts: 3, backoff: new ConstantBackoff(0) } },
        next,
      );

      expect(next).toHaveBeenCalledTimes(3);
      expect(result).toBe("ok");
    });

    it("throws after exhausting retries", async () => {
      const mw = resilience<Ctx>();
      const next = vi.fn().mockRejectedValue(new Error("always fails"));

      await expect(
        mw(ctx, { retry: { maxAttempts: 2, backoff: new ConstantBackoff(0) } }, next),
      ).rejects.toThrow("always fails");

      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe("timeout", () => {
    it("succeeds when call completes within timeout", async () => {
      const mw = resilience<Ctx>();
      const next = vi.fn().mockResolvedValue("fast");

      const result = await mw(
        ctx,
        { timeout: { duration: 1000, strategy: TimeoutStrategy.Aggressive } },
        next,
      );

      expect(result).toBe("fast");
    });

    it("throws TaskCancelledError when call exceeds timeout", async () => {
      const mw = resilience<Ctx>();
      const next = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500)));

      await expect(
        mw(ctx, { timeout: { duration: 10, strategy: TimeoutStrategy.Aggressive } }, next),
      ).rejects.toThrow();
    });
  });

  describe("circuit breaker", () => {
    it("allows calls when circuit is closed", async () => {
      const breaker = createCircuitBreaker({
        halfOpenAfter: 1000,
        breaker: new ConsecutiveBreaker(3),
      });
      const mw = resilience<Ctx>();
      const next = vi.fn().mockResolvedValue("ok");

      const result = await mw(ctx, { circuitBreaker: breaker }, next);

      expect(result).toBe("ok");
    });

    it("rejects calls when circuit is open", async () => {
      const breaker = createCircuitBreaker({
        halfOpenAfter: 10000,
        breaker: new ConsecutiveBreaker(2),
      });
      const mw = resilience<Ctx>();
      const failing = vi.fn().mockRejectedValue(new Error("fail"));

      // Trip the breaker
      await mw(ctx, { circuitBreaker: breaker }, failing).catch(() => {});
      await mw(ctx, { circuitBreaker: breaker }, failing).catch(() => {});

      // Now circuit should be open
      const next = vi.fn().mockResolvedValue("ok");
      await expect(mw(ctx, { circuitBreaker: breaker }, next)).rejects.toThrow(/circuit/i);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("composition", () => {
    it("composes retry + timeout", async () => {
      const mw = resilience<Ctx>();
      let callCount = 0;
      const next = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return new Promise((resolve) => setTimeout(resolve, 500));
        }
        return "ok";
      });

      const result = await mw(
        ctx,
        {
          retry: { maxAttempts: 3, backoff: new ConstantBackoff(0) },
          timeout: { duration: 10, strategy: TimeoutStrategy.Aggressive },
        },
        next,
      );

      expect(result).toBe("ok");
      expect(next).toHaveBeenCalledTimes(2);
    });
  });
});
