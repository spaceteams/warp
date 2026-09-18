import type {
  AnyFactory,
  ComponentFactory,
  InferCtx,
  InferRunOptions,
  InferScopeContext,
  UnionToIntersection,
} from "../component";
import type { ComponentMeta } from "../component/component-meta";

export type CombinedOutput<T extends Record<string, AnyFactory>> = {
  [K in keyof T]: ReturnType<T[K]>;
};

/**
 * Combines multiple component factories into a single module factory.
 *
 * The combined factory calls each sub-factory **directly with the current scope
 * context** during resolution. **Middleware is NOT invoked** for the combined
 * module or its sub-factories — unless a sub-factory is itself a `callable` or
 * `usecase`, in which case middleware fires when that sub-factory is later invoked.
 *
 * Context requirements from all inner factories are intersected automatically,
 * so the combined component demands everything its parts need.
 *
 * @param options - Component metadata (name, tags). `kind` is automatically set to "module".
 * @param factories - Record of named factories to combine.
 *
 * @example
 * ```ts
 * const userModule = combine(
 *   { name: "user-module" },
 *   {
 *     find: callable({ name: "find-user" }, (ctx) => async (id) => ctx.db.find(id)),
 *     create: callable({ name: "create-user" }, (ctx) => async (data) => ctx.db.insert(data)),
 *   },
 * );
 * ```
 */
export function combine<const T extends Record<string, AnyFactory>>(
  options: Omit<ComponentMeta, "kind">,
  factories: T,
): ComponentFactory<
  UnionToIntersection<InferCtx<T[keyof T]>>,
  UnionToIntersection<InferScopeContext<T[keyof T]>>,
  UnionToIntersection<InferRunOptions<T[keyof T]>>,
  unknown,
  CombinedOutput<T>
> {
  const factory = (ctx: unknown) => {
    const result: Record<string, unknown> = {};
    for (const [key, f] of Object.entries(factories)) {
      result[key] = (f as (ctx: unknown) => unknown)(ctx);
    }
    return result;
  };
  Object.assign(factory, {
    meta: {
      kind: "module" as const,
      name: options.name,
      tags: options.tags,
    },
  });
  return factory as ComponentFactory<
    UnionToIntersection<InferCtx<T[keyof T]>>,
    UnionToIntersection<InferScopeContext<T[keyof T]>>,
    UnionToIntersection<InferRunOptions<T[keyof T]>>,
    unknown,
    CombinedOutput<T>
  >;
}

export type InferCombined<T> =
  T extends ComponentFactory<
    infer _Ctx,
    infer _ScopeContext,
    infer _RunOptions,
    infer _Deps,
    infer Out
  >
    ? Out
    : never;
