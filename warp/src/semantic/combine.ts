import type {
  AnyFactory,
  ComponentFactory,
  InferCtx,
  InferRunOptions,
  InferScopeContext,
  UnionToIntersection,
} from "../component";

export type CombinedOutput<T extends Record<string, AnyFactory>> = {
  [K in keyof T]: ReturnType<T[K]>;
};

export function combine<const T extends Record<string, AnyFactory>>(
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
