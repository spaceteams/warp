import type { ComponentFactory } from "../component";
import type { NoRunOptions, NoScopeContext } from "../middleware";
import type { Run } from "../run";

export type Usecase<
  Ctx,
  ScopeContext,
  Args extends unknown[],
  Result,
  RunOptions,
> = ComponentFactory<Ctx, ScopeContext, RunOptions, unknown, (...args: Args) => Promise<Result>>;
export function usecaseFactory<
  Ctx,
  Args extends unknown[],
  Result,
  RunOptions = NoRunOptions,
  ScopeContext = NoScopeContext,
>(
  options: RunOptions & {
    name: string;
    tags?: string[];
  },
  fn: (app: Run<Ctx, ScopeContext, RunOptions>) => (...args: Args) => Promise<Result>,
): Usecase<Ctx, ScopeContext, Args, Result, RunOptions> {
  const factory: Usecase<Ctx, ScopeContext, Args, Result, RunOptions> =
    (ctx) =>
    (...args) => {
      return ctx.run(options, (inner) => fn(inner)(...args)) as Promise<Result>;
    };
  Object.assign(factory, {
    meta: {
      kind: "usecase" as const,
      name: options.name,
      tags: options.tags,
    },
  });
  return factory;
}
export type InferUsecase<T> =
  T extends Usecase<infer _Ctx, infer _ScopeContext, infer Args, infer Result, infer _RunOptions>
    ? (...args: Args) => Promise<Result>
    : never;
