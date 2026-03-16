import type { ComponentMeta } from "../component";
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
