import type { Middleware } from "@spaceteams/warp";
import {
  type CircuitBreakerPolicy,
  ConsecutiveBreaker,
  ConstantBackoff,
  circuitBreaker as cockatielCircuitBreaker,
  retry as cockatielRetry,
  timeout as cockatielTimeout,
  ExponentialBackoff,
  handleAll,
  type IBackoffFactory,
  type ICircuitBreakerOptions,
  type IPolicy,
  SamplingBreaker,
  TimeoutStrategy,
  wrap,
} from "cockatiel";

export type ResilienceOptions = {
  /** Retry configuration. Retries the call on any error. */
  retry: {
    /** Total number of attempts (including the first). Default: 3 */
    maxAttempts?: number;
    /** Backoff strategy between retries. Default: ExponentialBackoff */
    backoff?: IBackoffFactory<unknown>;
  };
  /** Timeout configuration. Applies per individual attempt. */
  timeout: {
    /** Timeout duration in milliseconds */
    duration: number;
    /** Timeout strategy. Default: Aggressive (immediately rejects) */
    strategy?: TimeoutStrategy;
  };
  /**
   * Circuit breaker policy instance. Must be created outside the middleware
   * and shared across calls so it can track failure state.
   *
   * Create one with `createCircuitBreaker()` or cockatiel's `circuitBreaker()`.
   */
  circuitBreaker: CircuitBreakerPolicy;
};

/**
 * Creates a resilience middleware that composes retry, circuit breaker, and
 * timeout policies from cockatiel.
 *
 * Execution order (outermost → innermost):
 *   retry → circuitBreaker → timeout → next(ctx)
 */
export const resilience = <Ctx extends NonNullable<unknown>>(): Middleware<
  Ctx,
  ResilienceOptions
> => {
  return async (ctx, options, next) => {
    const policies: IPolicy[] = [];

    if (options.retry) {
      const { maxAttempts = 3, backoff = new ExponentialBackoff() } = options.retry;
      policies.push(cockatielRetry(handleAll, { maxAttempts: maxAttempts - 1, backoff }));
    }

    if (options.circuitBreaker) {
      policies.push(options.circuitBreaker);
    }

    if (options.timeout) {
      const { duration, strategy = TimeoutStrategy.Aggressive } = options.timeout;
      policies.push(cockatielTimeout(duration, strategy));
    }

    if (policies.length === 0) {
      return next(ctx);
    }

    const policy = policies.length === 1 ? policies[0] : wrap(...policies);

    return policy.execute(() => next(ctx));
  };
};

/**
 * Convenience factory to create a cockatiel CircuitBreakerPolicy.
 * The returned instance should be shared across calls (pass it via options).
 */
export function createCircuitBreaker(opts: ICircuitBreakerOptions): CircuitBreakerPolicy {
  return cockatielCircuitBreaker(handleAll, opts);
}

export type { CircuitBreakerPolicy, IBackoffFactory, ICircuitBreakerOptions };
// Re-export useful cockatiel utilities
export {
  ConsecutiveBreaker,
  ConstantBackoff,
  ExponentialBackoff,
  handleAll,
  SamplingBreaker,
  TimeoutStrategy,
};
