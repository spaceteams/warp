import type { ComponentFactory } from "../component";
import type { ComponentMeta } from "../component/component-meta";
import type { NoRunOptions, NoScopeContext } from "../middleware";
import type { Run } from "../run";

export type Repo<Ctx, ScopeContext, Out, RunOptions> = ComponentFactory<
  Ctx,
  ScopeContext,
  RunOptions,
  unknown,
  Out
>;
export function repo<Ctx, Out, RunOptions = NoRunOptions, ScopeContext = NoScopeContext>(
  options: Omit<ComponentMeta, "kind">,
  fn: (app: Run<Ctx, ScopeContext, RunOptions>) => Out,
): Repo<Ctx, ScopeContext, Out, RunOptions> {
  const factory: Repo<Ctx, ScopeContext, Out, RunOptions> = fn;
  Object.assign(factory, {
    meta: {
      kind: "repo" as const,
      name: options.name,
      tags: options.tags,
    },
  });
  return factory;
}
export type InferRepo<T> =
  T extends Repo<infer _Ctx, infer _ScopeContext, infer Out, infer _RunOptions> ? Out : never;
