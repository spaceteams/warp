import type {
  AnyFactory,
  ComponentFactory,
  InferCtx,
  InferRunOptions,
  InferScopeContext,
  UnionToIntersection,
} from "../component";
import type { ComponentMeta } from "../component/component-meta";

export type ClientOutput<T extends Record<string, AnyFactory>> = {
  [K in keyof T]: ReturnType<T[K]>;
};

/**
 * Creates a client component factory that bundles multiple factories into
 * a single component with `kind: "client"`.
 *
 * Each value in the record should typically be a `callable` or `usecase` so
 * that middleware fires when the method is invoked. Plain functions can also
 * be used, but they will not trigger middleware.
 *
 * @param options - Component metadata (name, tags). `kind` is automatically set to "client".
 * @param factories - Record of named factories to bundle.
 *
 * @example
 * ```ts
 * const apiClient = client({ name: "api-client" }, {
 *   getUser: callable({ name: "getUser" }, (ctx) => async (id: string) => ctx.fetch(`/users/${id}`)),
 * });
 * ```
 */
export function client<const T extends Record<string, AnyFactory>>(
  options: Omit<ComponentMeta, "kind">,
  factories: T,
): ComponentFactory<
  UnionToIntersection<InferCtx<T[keyof T]>>,
  UnionToIntersection<InferScopeContext<T[keyof T]>>,
  UnionToIntersection<InferRunOptions<T[keyof T]>>,
  unknown,
  ClientOutput<T>
> & { meta: { kind: "client"; name?: string; tags?: string[] } } {
  const factory = (ctx: unknown) => {
    const result: Record<string, unknown> = {};
    for (const [key, f] of Object.entries(factories)) {
      result[key] = (f as (ctx: unknown) => unknown)(ctx);
    }
    return result;
  };
  Object.assign(factory, {
    meta: {
      kind: "client" as const,
      name: options.name,
      tags: options.tags,
    },
  });
  return factory as ComponentFactory<
    UnionToIntersection<InferCtx<T[keyof T]>>,
    UnionToIntersection<InferScopeContext<T[keyof T]>>,
    UnionToIntersection<InferRunOptions<T[keyof T]>>,
    unknown,
    ClientOutput<T>
  > & { meta: { kind: "client"; name?: string; tags?: string[] } };
}

export type InferClient<T> =
  T extends ComponentFactory<infer _Ctx, infer _SC, infer _RO, infer _Deps, infer Out>
    ? Out
    : never;
