import type { Component, ComponentFactory, ComponentInput, ComponentMeta, ComponentRef } from ".";
import { brandComponent } from ".";

export function defineFunctionalComponent<Ctx, ScopeContext, RunOptions>() {
  return <Deps, F extends ComponentFactory<Ctx, ScopeContext, RunOptions, Deps, ReturnType<F>>>(
    factory: F,
    deps?: { [T in keyof Deps]: ComponentInput<Ctx, ScopeContext, RunOptions, Deps[T]> },
    meta?: ComponentMeta,
  ): Component<Ctx, ScopeContext, RunOptions, Deps, ReturnType<F>> => {
    return brandComponent({
      factory,
      deps: deps as {
        [K in keyof Deps]: ComponentRef<Ctx, ScopeContext, RunOptions, Deps[K]>;
      },
      meta: {
        name: (meta?.name ?? factory.meta?.name) || undefined,
        tags: (meta?.tags ?? factory.meta?.tags) || undefined,
        kind: (meta?.kind ?? factory.meta?.kind) || undefined,
      },
    });
  };
}
