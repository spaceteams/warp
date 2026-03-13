import type { Run } from "../run";
import type { Component, ComponentFactory, ComponentInput, ComponentRef } from ".";
import { brandComponent } from ".";

export function defineClassComponent<Ctx, RunOptions>() {
  return <Deps, Ctor extends new (deps: Run<Ctx & Deps, RunOptions>) => InstanceType<Ctor>>(
    ctor: Ctor,
    deps?: { [K in keyof Deps]: ComponentInput<Ctx, RunOptions, Deps[K]> },
    opts?: { name?: string },
  ): Component<Ctx, RunOptions, Deps, InstanceType<Ctor>> => {
    const factory: ComponentFactory<Ctx, RunOptions, Deps, InstanceType<Ctor>> = (ctx) => {
      return new ctor(ctx);
    };

    return brandComponent({
      factory,
      deps: deps as {
        [K in keyof Deps]: ComponentRef<Ctx, RunOptions, Deps[K]>;
      },
      name: opts?.name ?? ctor.name,
    });
  };
}
