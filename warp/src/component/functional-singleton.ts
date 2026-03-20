import { Lazy } from "../lazy";
import type { NoScopeContext } from "../middleware";
import type { Component, ComponentFactory, ComponentInput, ComponentRef } from ".";
import { brandComponent } from ".";
import type { ComponentMeta } from "./component-meta";

export function defineFunctionalSingleton<Ctx, RunOptions>() {
  return <Deps, F extends ComponentFactory<Ctx, NoScopeContext, RunOptions, Deps, ReturnType<F>>>(
    factory: F,
    deps?: { [T in keyof Deps]: ComponentInput<Ctx, NoScopeContext, RunOptions, Deps[T]> },
    meta?: ComponentMeta,
  ): Component<Ctx, NoScopeContext, RunOptions, Deps, ReturnType<F>> => {
    const cachedFactory = Lazy.cached(factory);
    return brandComponent({
      factory: cachedFactory,
      deps: deps as {
        [K in keyof Deps]: ComponentRef<Ctx, NoScopeContext, RunOptions, Deps[K]>;
      },
      meta: {
        name: (meta?.name ?? factory.meta?.name) || undefined,
        tags: (meta?.tags ?? factory.meta?.tags) || undefined,
        kind: (meta?.kind ?? factory.meta?.kind) || undefined,
      },
    });
  };
}
