import type { ComponentFactory } from "../component";
import type { ComponentMeta } from "../component/component-meta";
import type { NoRunOptions, NoScopeContext } from "../middleware";
import type { Run } from "../run";

export type Callable<
  Ctx,
  ScopeContext,
  Args extends unknown[],
  Result,
  RunOptions,
> = ComponentFactory<Ctx, ScopeContext, RunOptions, unknown, (...args: Args) => Promise<Result>>;

/**
 * Creates a callable component factory.
 *
 * Unlike `repo`, `client`, or `service`, a `callable` **defers execution**.
 * The factory returns a function that, when called, triggers `ctx.run(options, …)`.
 * This means **middleware IS invoked at invocation time** with the provided
 * `options` and component metadata (`warp`).
 *
 * Use `callable` when you need middleware-managed context inside the operation
 * (e.g. child loggers, tracing spans, retry policies, transactions).
 *
 * @param options - Run options merged with component metadata (kind, name, tags).
 * @param fn - Factory function that receives the run context and returns the async operation.
 *
 * @example
 * ```ts
 * const findUser = callable<{ db: DB }, [string], User>(
 *   { name: "find-user" },
 *   (ctx) => async (id) => ctx.db.query(id),
 * );
 * ```
 */
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
