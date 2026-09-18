import type { ComponentMeta } from "../component/component-meta";
import type { NoRunOptions, NoScopeContext } from "../middleware";
import type { Run } from "../run";
import { type Callable, callable, type InferCallable } from "./callable";

export type Usecase<Ctx, ScopeContext, Args extends unknown[], Result, RunOptions> = Callable<
  Ctx,
  ScopeContext,
  Args,
  Result,
  RunOptions
>;

/**
 * Creates a usecase component factory.
 *
 * A `usecase` is a convenience wrapper over `callable` with `kind: "usecase"`.
 * Like `callable`, it **defers execution** and **invokes middleware at call time**
 * via `ctx.run(options, …)`. This ensures middleware-managed context (e.g. child
 * loggers, tracing spans, retry policies, transactions) is available inside the
 * usecase body.
 *
 * @param options - Run options merged with component metadata (name, tags). `kind` is automatically set to "usecase".
 * @param fn - Factory function that receives the run context and returns the async operation.
 *
 * @example
 * ```ts
 * const createOrder = usecase<{ db: DB; logger: Logger }, [string], Order>(
 *   { name: "create-order" },
 *   (ctx) => async (productId) => {
 *     ctx.logger.info(`Creating order for ${productId}`);
 *     return ctx.db.insert(productId);
 *   },
 * );
 * ```
 */
export function usecase<
  Ctx,
  Args extends unknown[],
  Result,
  RunOptions = NoRunOptions,
  ScopeContext = NoScopeContext,
>(
  options: RunOptions & Omit<ComponentMeta, "kind">,
  fn: (app: Run<Ctx, ScopeContext, RunOptions>) => (...args: Args) => Promise<Result>,
): Usecase<Ctx, ScopeContext, Args, Result, RunOptions> {
  return callable({ kind: "usecase" as const, ...options }, fn);
}
export type InferUsecase<T> = InferCallable<T>;
