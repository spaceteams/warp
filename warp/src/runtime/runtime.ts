import type { Component } from "../component";
import { defineClassComponent } from "../component/class-component";
import { defineClassSingleton } from "../component/class-singleton";
import { defineFunctionalComponent } from "../component/functional-component";
import { defineFunctionalSingleton } from "../component/functional-singleton";
import { type ExplainResult, explain } from "../explain";
import { toAsciiTree } from "../explain/ascii";
import { toMermaid } from "../explain/mermaid";
import { Lazy } from "../lazy";
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
    root: Component<Ctx, ScopeContext, RunOptions, Deps, Out>,
    ctx: Ctx,
  ) => Out | Promise<Out>;

  constructor(
    private readonly middleware: Middleware<Ctx, RunOptions, ScopeContext>,
    private readonly ctx: Lazy<ActualContext>,
  ) {
    this.resolveFn = createResolver<Ctx, ScopeContext, RunOptions>(middleware);
  }

  public provide<Extension>(ext: Extension) {
    return new Runtime<Ctx, ActualContext & Extension, ScopeContext, RunOptions, Requirements>(
      this.middleware,
      Lazy.and(this.ctx, () => ext),
    );
  }
  public provideLazy<Extension>(ext: () => Extension) {
    return new Runtime<Ctx, ActualContext & Extension, ScopeContext, RunOptions, Requirements>(
      this.middleware,
      Lazy.and(this.ctx, Lazy.cached(ext)),
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

  public resolve = <Deps, Out>(
    component: Component<
      SafeIntersect<Requirements, ActualContext>,
      ScopeContext,
      RunOptions,
      Deps,
      Out
    >,
    ...requirements: OptionalArg<Requirements>
  ) => {
    const req = requirements[0] as Requirements | undefined;
    const ctx = req ? { ...this.ctx(), ...req } : { ...this.ctx() };
    return this.resolveFn(component as Component<Ctx, ScopeContext, RunOptions, Deps, Out>, ctx);
  };

  get component() {
    return defineFunctionalComponent<
      SafeIntersect<Requirements, ActualContext>,
      ScopeContext,
      RunOptions
    >();
  }

  get singleton() {
    return defineFunctionalSingleton<SafeIntersect<Requirements, ActualContext>, RunOptions>();
  }

  get classComponent() {
    return defineClassComponent<
      SafeIntersect<Requirements, ActualContext>,
      ScopeContext,
      RunOptions
    >();
  }

  get classSingleton() {
    return defineClassSingleton<SafeIntersect<Requirements, ActualContext>, RunOptions>();
  }

  // Overloads for explain method with format parameter
  public explain<Deps, Out>(
    component: Component<
      SafeIntersect<Requirements, ActualContext>,
      ScopeContext,
      RunOptions,
      Deps,
      Out
    >,
    format: "native",
    showMeta?: boolean,
  ): ExplainResult;
  public explain<Deps, Out>(
    component: Component<
      SafeIntersect<Requirements, ActualContext>,
      ScopeContext,
      RunOptions,
      Deps,
      Out
    >,
    format: "ascii",
    showMeta?: boolean,
  ): string;
  public explain<Deps, Out>(
    component: Component<
      SafeIntersect<Requirements, ActualContext>,
      ScopeContext,
      RunOptions,
      Deps,
      Out
    >,
    format: "mermaid",
    showMeta?: boolean,
  ): string;
  public explain<Deps, Out>(
    component: Component<
      SafeIntersect<Requirements, ActualContext>,
      ScopeContext,
      RunOptions,
      Deps,
      Out
    >,
  ): ExplainResult;

  // Implementation
  public explain<Deps, Out>(
    component: Component<
      SafeIntersect<Requirements, ActualContext>,
      ScopeContext,
      RunOptions,
      Deps,
      Out
    >,
    format: "native" | "ascii" | "mermaid" = "native",
    showMeta = false,
  ): ExplainResult | string {
    const result = explain(component);
    switch (format) {
      case "ascii":
        return toAsciiTree(result, "", true, showMeta);
      case "mermaid":
        return toMermaid(result, showMeta);
      case "native":
        return result;
    }
  }
}
