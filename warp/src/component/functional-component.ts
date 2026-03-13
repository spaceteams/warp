import type { Component, ComponentFactory, ComponentInput, ComponentRef } from ".";
import { brandComponent } from ".";

export function defineFunctionalComponent<Ctx, RunOptions>() {
  return <Deps, F extends ComponentFactory<Ctx, RunOptions, Deps, ReturnType<F>>>(
    factory: F,
    deps?: { [T in keyof Deps]: ComponentInput<Ctx, RunOptions, Deps[T]> },
    opts?: { name?: string },
  ): Component<Ctx, RunOptions, Deps, ReturnType<F>> => {
    return brandComponent({
      factory,
      deps: deps as {
        [K in keyof Deps]: ComponentRef<Ctx, RunOptions, Deps[K]>;
      },
      name: opts?.name,
    });
  };
}
