import { Lazy } from "../lazy";
import type { NoScopeContext } from "../middleware";
import type { Run } from "../run";
import type { Component, ComponentFactory, ComponentInput, ComponentRef } from ".";
import { brandComponent } from ".";
import type { ComponentMeta } from "./component-meta";

export function defineClassSingleton<Ctx, RunOptions>() {
  return <
    Deps,
    Ctor extends (new (
      deps: Run<Ctx & Deps, NoScopeContext, RunOptions>,
    ) => InstanceType<Ctor>) & { meta?: ComponentMeta },
  >(
    ctor: Ctor,
    deps?: { [K in keyof Deps]: ComponentInput<Ctx, NoScopeContext, RunOptions, Deps[K]> },
    meta?: ComponentMeta,
  ): Component<Ctx, NoScopeContext, RunOptions, Deps, InstanceType<Ctor>> => {
    const factory: ComponentFactory<Ctx, NoScopeContext, RunOptions, Deps, InstanceType<Ctor>> = (
      ctx,
    ) => {
      return new ctor(ctx);
    };
    const cachedFactory = Lazy.cached(factory);

    return brandComponent({
      factory: cachedFactory,
      deps: deps as {
        [K in keyof Deps]: ComponentRef<Ctx, NoScopeContext, RunOptions, Deps[K]>;
      },
      meta: {
        name: (meta?.name ?? ctor.meta?.name) || undefined,
        tags: (meta?.tags ?? ctor.meta?.tags) || undefined,
        kind: (meta?.kind ?? ctor.meta?.kind) || undefined,
      },
    });
  };
}
