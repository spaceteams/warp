import type { ComponentFactory } from "../component";
import type { ComponentMeta } from "../component/component-meta";
import type { NoRunOptions, NoScopeContext } from "../middleware";
import type { Run } from "../run";

export type Service<Ctx, ScopeContext, Out, RunOptions> = ComponentFactory<
  Ctx,
  ScopeContext,
  RunOptions,
  unknown,
  Out
>;

/**
 * Creates a service component factory.
 *
 * The factory is resolved immediately during dependency graph resolution.
 * **Middleware is NOT invoked** during resolution — the returned object is
 * created directly with the current scope context. If you need middleware-managed
 * context (e.g. child loggers, tracing spans) inside service methods, use
 * `callable` instead or access the context through a parent `usecase` / `callable`.
 *
 * @param options - Component metadata (name, tags). `kind` is automatically set to "service".
 * @param fn - Factory function that receives the run context and returns the service object.
 *
 * @example
 * ```ts
 * const pricingService = service({ name: "pricing-service" }, (ctx) => ({
 *   calculate: (productId: string) => ctx.priceRepo(productId) * 1.19,
 * }));
 * ```
 */
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
