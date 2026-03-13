import type { Run } from "../run";

export type NoDeps = NonNullable<unknown>;

const COMPONENT: unique symbol = Symbol("component");
export type ComponentRef<Ctx, RunOptions, Out> = {
  readonly [COMPONENT]: true;
  readonly __ctx?: Ctx;
  readonly __runOptions?: RunOptions;
  readonly __out?: Out;
};

export type ComponentFactory<Ctx, RunOptions, Deps, Out> = (
  ctx: Run<Ctx & Deps, RunOptions>,
) => Out;

export type ComponentInput<Ctx, RunOptions, Out> = ComponentRef<Ctx, RunOptions, Out> | Out;

export type Component<Ctx, RunOptions, Deps, Out> = ComponentRef<Ctx, RunOptions, Out> & {
  factory: ComponentFactory<Ctx, RunOptions, Deps, Out>;
  deps?: { [K in keyof Deps]: ComponentRef<Ctx, RunOptions, Deps[K]> };
  name?: string;
};

export type ComponentDefinition<Ctx, RunOptions, Deps, Out> = {
  factory: ComponentFactory<Ctx, RunOptions, Deps, Out>;
  deps?: { [K in keyof Deps]: ComponentInput<Ctx, RunOptions, Deps[K]> };
  name?: string;
};

export type InferComponentParams<T> =
  T extends Component<infer Ctx, infer RunOptions, infer Deps, infer Out>
    ? [Ctx, RunOptions, Deps, Out]
    : never;
export type InferComponentCtx<T> = InferComponentParams<T>[0];
export type InferComponentRunOptions<T> = InferComponentParams<T>[1];
export type InferComponentDeps<T> = InferComponentParams<T>[2];
export type InferComponentOut<T> = InferComponentParams<T>[3];

export function brandComponent<T extends object, Ctx, RunOptions, Out>(
  obj: T,
): T & ComponentRef<Ctx, RunOptions, Out> {
  Object.defineProperty(obj, COMPONENT, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return obj as T & ComponentRef<Ctx, RunOptions, Out>;
}

export function isComponent(
  value: unknown,
): value is Component<unknown, unknown, unknown, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { [COMPONENT]?: unknown })[COMPONENT] === true
  );
}
