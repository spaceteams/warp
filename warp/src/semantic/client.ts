import type { ComponentFactory } from "../component";
import type { ComponentMeta } from "../component/component-meta";
import type { NoRunOptions, NoScopeContext } from "../middleware";
import type { Run } from "../run";

export type Client<Ctx, ScopeContext, Out, RunOptions> = ComponentFactory<
  Ctx,
  ScopeContext,
  RunOptions,
  unknown,
  Out
>;
export function client<Ctx, Out, RunOptions = NoRunOptions, ScopeContext = NoScopeContext>(
  options: Omit<ComponentMeta, "kind">,
  fn: (app: Run<Ctx, ScopeContext, RunOptions>) => Out,
): Client<Ctx, ScopeContext, Out, RunOptions> {
  const factory: Client<Ctx, ScopeContext, Out, RunOptions> = fn;
  Object.assign(factory, {
    meta: {
      kind: "client" as const,
      name: options.name,
      tags: options.tags,
    },
  });
  return factory;
}
export type InferClient<T> =
  T extends Client<infer _Ctx, infer _ScopeContext, infer Out, infer _RunOptions> ? Out : never;
