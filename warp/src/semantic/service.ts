import type { ComponentFactory, ComponentMeta } from "../component";
import type { NoRunOptions, NoScopeContext } from "../middleware";
import type { Run } from "../run";

export type Service<Ctx, ScopeContext, Out, RunOptions> = ComponentFactory<
  Ctx,
  ScopeContext,
  RunOptions,
  unknown,
  Out
>;
export function service<Ctx, Out, RunOptions = NoRunOptions, ScopeContext = NoScopeContext>(
  options: Omit<ComponentMeta, "kind"> = {},
  fn: (app: Run<Ctx, ScopeContext, RunOptions>) => Out,
): Service<Ctx, ScopeContext, Out, RunOptions> {
  const factory: Service<Ctx, ScopeContext, Out, RunOptions> = fn;
  Object.assign(factory, {
    meta: {
      kind: "service" as const,
      name: options.name,
      tags: options.tags,
    },
  });
  return factory;
}
export type InferService<T> =
  T extends Service<infer _Ctx, infer _ScopeContext, infer Out, infer _RunOptions> ? Out : never;
