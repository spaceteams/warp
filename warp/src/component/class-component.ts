import type { Run } from "../run";
import type { Component, ComponentFactory, ComponentInput, ComponentRef } from ".";
import { brandComponent } from ".";

export function defineClassComponent<Ctx, ScopeContext, RunOptions>() {
  return <
    Deps,
    Ctor extends new (
      deps: Run<Ctx & Deps, ScopeContext, RunOptions>,
    ) => InstanceType<Ctor>,
  >(
    ctor: Ctor,
    deps?: { [K in keyof Deps]: ComponentInput<Ctx, ScopeContext, RunOptions, Deps[K]> },
    opts?: { name?: string },
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
      name: opts?.name ?? ctor.name,
    });
  };
}
