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

/**
 * Creates a client component factory.
 *
 * The factory is resolved immediately during dependency graph resolution.
 * **Middleware is NOT invoked** during resolution — the returned object is
 * created directly with the current scope context. If you need middleware-managed
 * context (e.g. child loggers, tracing spans) inside client methods, use
 * `callable` instead or access the context through a parent `usecase` / `callable`.
 *
 * @param options - Component metadata (name, tags). `kind` is automatically set to "client".
 * @param fn - Factory function that receives the run context and returns the client object.
 *
 * @example
 * ```ts
 * const httpClient = client({ name: "api-client" }, (ctx) => ({
 *   get: (url: string) => ctx.fetch(url),
 * }));
 * ```
 */
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
