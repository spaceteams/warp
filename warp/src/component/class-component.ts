import type { Run } from "../run";
import type { Component, ComponentFactory, ComponentInput, ComponentMeta, ComponentRef } from ".";
import { brandComponent } from ".";

export function defineClassComponent<Ctx, ScopeContext, RunOptions>() {
  return <
    Deps,
    Ctor extends (new (
      deps: Run<Ctx & Deps, ScopeContext, RunOptions>,
    ) => InstanceType<Ctor>) & { meta?: ComponentMeta },
  >(
    ctor: Ctor,
    deps?: { [K in keyof Deps]: ComponentInput<Ctx, ScopeContext, RunOptions, Deps[K]> },
    meta?: ComponentMeta,
  ): Component<Ctx, ScopeContext, RunOptions, Deps, InstanceType<Ctor>> => {
    const factory: ComponentFactory<Ctx, ScopeContext, RunOptions, Deps, InstanceType<Ctor>> = (
      ctx,
    ) => {
      return new ctor(ctx);
    };

    return brandComponent({
      factory,
      deps: deps as {
        [K in keyof Deps]: ComponentRef<Ctx, ScopeContext, RunOptions, Deps[K]>;
      },
      meta: {
        name: (meta?.name ?? ctor.meta?.name) || undefined,
        tags: (meta?.tags ?? ctor.meta?.tags) || undefined,
        kind: (meta?.kind ?? ctor.meta?.kind) || undefined,
      },
    });
  };
}
