import type { Component } from "../component";
import { defineClassComponent } from "../component/class-component";
import { defineFunctionalComponent } from "../component/functional-component";
import type { Middleware } from "../middleware";
import { createResolver } from "./create-resolver";

type SafeIntersect<A, B> = A extends undefined ? B : A & B;
type OptionalArg<A> = A extends undefined ? [] : [A];

export class Runtime<
  Ctx,
  ActualContext extends Ctx,
  ScopeContext,
  RunOptions,
  Requirements = undefined,
> {
  private readonly resolveFn: <Deps, Out>(
    root: Component<Ctx, RunOptions, Deps, Out>,
    ctx: Ctx,
  ) => Out | Promise<Out>;
  constructor(
    private readonly middleware: Middleware<Ctx, RunOptions, ScopeContext>,
    private readonly ctx: ActualContext,
  ) {
    this.resolveFn = createResolver<Ctx, ScopeContext, RunOptions>(middleware);
  }

  public provide<Extension>(ext: Extension) {
    return new Runtime<Ctx, ActualContext & Extension, ScopeContext, RunOptions, Requirements>(
      this.middleware,
      {
        ...this.ctx,
        ...ext,
      },
    );
  }
  public require<Extension>() {
    return new Runtime<
      Ctx,
      ActualContext,
      ScopeContext,
      RunOptions,
      SafeIntersect<Requirements, Extension>
    >(this.middleware, this.ctx);
  }

  // this should work when destructuring the runtime object, so we use a lambda here
  public resolve = <Deps, Out>(
    component: Component<SafeIntersect<Requirements, ActualContext>, RunOptions, Deps, Out>,
    ...requirements: OptionalArg<Requirements>
  ) => {
    const req = requirements[0] as Requirements | undefined;
    const ctx = req ? { ...this.ctx, ...(req as object) } : { ...this.ctx };
    return this.resolveFn(component as Component<Ctx, RunOptions, Deps, Out>, ctx);
  };

  get component() {
    return defineFunctionalComponent<SafeIntersect<Requirements, ActualContext>, RunOptions>();
  }

  get classComponent() {
    return defineClassComponent<SafeIntersect<Requirements, ActualContext>, RunOptions>();
  }
}
