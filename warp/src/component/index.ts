import type { Run } from "../run";

export type NoDeps = NonNullable<unknown>;

const COMPONENT: unique symbol = Symbol("component");
export type ComponentRef<Ctx, ScopeContext, RunOptions, Out> = {
  readonly [COMPONENT]: true;
  readonly __ctx?: Ctx;
  readonly __scopeContext?: ScopeContext;
  readonly __runOptions?: RunOptions;
  readonly __out?: Out;
};

export type ComponentFactory<Ctx, ScopeContext, RunOptions, Deps, Out> = (
  ctx: Run<Ctx & Deps, ScopeContext, RunOptions>,
) => Out;

export type ComponentInput<Ctx, ScopeContext, RunOptions, Out> =
  | ComponentRef<Ctx, ScopeContext, RunOptions, Out>
  | Out;

export type Component<Ctx, ScopeContext, RunOptions, Deps, Out> = ComponentRef<
  Ctx,
  ScopeContext,
  RunOptions,
  Out
> & {
  factory: ComponentFactory<Ctx, ScopeContext, RunOptions, Deps, Out>;
  deps?: { [K in keyof Deps]: ComponentRef<Ctx, ScopeContext, RunOptions, Deps[K]> };
  name?: string;
};

export type ComponentDefinition<Ctx, ScopeContext, RunOptions, Deps, Out> = {
  factory: ComponentFactory<Ctx, ScopeContext, RunOptions, Deps, Out>;
  deps?: { [K in keyof Deps]: ComponentInput<Ctx, ScopeContext, RunOptions, Deps[K]> };
  name?: string;
};

export type InferComponentParams<T> =
  T extends Component<infer Ctx, infer ScopeContext, infer RunOptions, infer Deps, infer Out>
    ? [Ctx, ScopeContext, RunOptions, Deps, Out]
    : never;
export type InferComponentCtx<T> = InferComponentParams<T>[0];
export type InferComponentScopeContext<T> = InferComponentParams<T>[1];
export type InferComponentRunOptions<T> = InferComponentParams<T>[2];
export type InferComponentDeps<T> = InferComponentParams<T>[3];
export type InferComponentOut<T> = InferComponentParams<T>[4];

export function brandComponent<T extends object, Ctx, ScopeContext, RunOptions, Out>(
  obj: T,
): T & ComponentRef<Ctx, ScopeContext, RunOptions, Out> {
  Object.defineProperty(obj, COMPONENT, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return obj as T & ComponentRef<Ctx, ScopeContext, RunOptions, Out>;
}

export function isComponent(
  value: unknown,
): value is Component<unknown, unknown, unknown, unknown, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { [COMPONENT]?: unknown })[COMPONENT] === true
  );
}
