import type { Component, ComponentFactory, ComponentInput, ComponentRef } from ".";
import { brandComponent } from ".";

export function defineFunctionalComponent<Ctx, ScopeContext, RunOptions>() {
  return <Deps, F extends ComponentFactory<Ctx, ScopeContext, RunOptions, Deps, ReturnType<F>>>(
    factory: F,
    deps?: { [T in keyof Deps]: ComponentInput<Ctx, ScopeContext, RunOptions, Deps[T]> },
    opts?: { name?: string },
  ): Component<Ctx, ScopeContext, RunOptions, Deps, ReturnType<F>> => {
    return brandComponent({
      factory,
      deps: deps as {
        [K in keyof Deps]: ComponentRef<Ctx, ScopeContext, RunOptions, Deps[K]>;
      },
      name: opts?.name,
    });
  };
}
