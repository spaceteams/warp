import type { ComponentFactory, ComponentMeta } from "../component";
import type { NoRunOptions, NoScopeContext } from "../middleware";
import type { Run } from "../run";

export type Callable<
  Ctx,
  ScopeContext,
  Args extends unknown[],
  Result,
  RunOptions,
> = ComponentFactory<Ctx, ScopeContext, RunOptions, unknown, (...args: Args) => Promise<Result>>;
export function callable<
  Ctx,
  Args extends unknown[],
  Result,
  RunOptions = NoRunOptions,
  ScopeContext = NoScopeContext,
>(
  options: RunOptions & ComponentMeta,
  fn: (app: Run<Ctx, ScopeContext, RunOptions>) => (...args: Args) => Promise<Result>,
): Callable<Ctx, ScopeContext, Args, Result, RunOptions> {
  const factory: Callable<Ctx, ScopeContext, Args, Result, RunOptions> =
    (ctx) =>
    (...args) => {
      return ctx.run(options, (inner) => fn(inner)(...args)) as Promise<Result>;
    };
  Object.assign(factory, {
    meta: {
      kind: options.kind,
      name: options.name,
      tags: options.tags,
    },
  });
  return factory;
}
export type InferCallable<T> =
  T extends Callable<infer _Ctx, infer _ScopeContext, infer Args, infer Result, infer _RunOptions>
    ? (...args: Args) => Promise<Result>
    : never;
