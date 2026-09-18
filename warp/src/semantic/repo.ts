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

/**
 * Creates a repository component factory.
 *
 * The factory is resolved immediately during dependency graph resolution.
 * **Middleware is NOT invoked** during resolution — the returned object is
 * created directly with the current scope context. If you need middleware-managed
 * context (e.g. child loggers, tracing spans) inside repository methods, use
 * `callable` instead or access the context through a parent `usecase` / `callable`.
 *
 * @param options - Component metadata (name, tags). `kind` is automatically set to "repo".
 * @param fn - Factory function that receives the run context and returns the repository object.
 *
 * @example
 * ```ts
 * const userRepo = repo({ name: "user-repo" }, (ctx) => ({
 *   findById: (id: string) => ctx.db.query(id),
 * }));
 * ```
 */
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
