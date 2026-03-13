import { type Component, type ComponentInput, isComponent } from "../component";
import type { Middleware } from "../middleware";
import type { Run } from "../run";

export function createResolver<AmbientContext, ScopeContext, Options>(
  mw: Middleware<AmbientContext, Options, ScopeContext>,
) {
  return <Deps, Out>(
    root: Component<AmbientContext, Options, Deps, Out>,
    ctx: AmbientContext,
  ): Out => {
    const stack: string[] = [];

    const checkCyclicDependency = (depPath: string): void => {
      // Extract the dependency name from the path (e.g., "b.a.b" -> "b")
      // For root dependencies, depPath is just the name (e.g., "b")
      const parts = depPath.split(".");
      const depName = parts.at(-1);
      if (!depName) {
        return;
      }

      // Check if this dependency name appears anywhere in the current stack
      // This detects cycles like: b -> b.a -> b.a.b (where "b" repeats)
      for (const stackPath of stack) {
        const stackParts = stackPath.split(".");
        if (stackParts.includes(depName)) {
          throw new Error(`Cyclic dependency: ${[...stack, depPath].join(" -> ")}`);
        }
      }
    };

    const withStackTracking = <T>(depPath: string, fn: () => T): T => {
      stack.push(depPath);
      try {
        return fn();
      } finally {
        stack.pop();
      }
    };

    const defineDependencyProperty = (
      target: Run<AmbientContext, Options, ScopeContext>,
      depName: string,
      depPath: string,
      depComp: ComponentInput<AmbientContext, Options, unknown>,
      scopeCtx: AmbientContext & ScopeContext,
      cache: Map<string, unknown>,
    ): void => {
      Object.defineProperty(target, depName, {
        enumerable: true,
        configurable: false,
        get() {
          if (cache.has(depName)) {
            return cache.get(depName);
          }

          checkCyclicDependency(depPath);

          const out = withStackTracking(depPath, () => bindInScope(depComp, scopeCtx, depPath));
          cache.set(depName, out);
          return out;
        },
      });
    };

    const attachDependencies = (
      runCtx: Run<AmbientContext, Options, ScopeContext>,
      deps: Record<string, ComponentInput<AmbientContext, Options, unknown>>,
      scopeCtx: AmbientContext & ScopeContext,
      pathPrefix: string,
      cache: Map<string, unknown>,
    ): void => {
      for (const [depName, depComp] of Object.entries(deps)) {
        const depPath = pathPrefix ? `${pathPrefix}.${depName}` : depName;
        defineDependencyProperty(runCtx, depName, depPath, depComp, scopeCtx, cache);
      }
    };

    const createBaseRunContext = (
      scopeCtx: AmbientContext & ScopeContext,
    ): Run<AmbientContext, Options, ScopeContext> => {
      return {
        ...scopeCtx,
        run: (nestedOptions, nestedInner) => runWithContext(scopeCtx, nestedOptions, nestedInner),
      };
    };

    const bindInScope = (
      comp: ComponentInput<AmbientContext, Options, unknown>,
      scopeCtx: AmbientContext & ScopeContext,
      path: string,
    ): unknown => {
      const localDepCache = new Map<string, unknown>();
      const runCtx = createBaseRunContext(scopeCtx);
      if (!isComponent(comp)) {
        return comp;
      }

      attachDependencies(runCtx, comp.deps ?? {}, scopeCtx, path, localDepCache);

      return (comp.factory as (ctx: unknown) => unknown)(runCtx);
    };

    const makeRootRunContext = (
      scopeCtx: AmbientContext & ScopeContext,
    ): Run<AmbientContext & ScopeContext & Deps, Options, ScopeContext> => {
      const rootCache = new Map<string, unknown>();
      const runCtx = createBaseRunContext(scopeCtx);

      attachDependencies(runCtx, root.deps ?? {}, scopeCtx, "", rootCache);

      return runCtx as Run<AmbientContext & ScopeContext & Deps, Options>;
    };

    const runWithContext = async <T>(
      currentCtx: AmbientContext & ScopeContext,
      options: Options,
      inner: (runApp: Run<AmbientContext & ScopeContext, Options, ScopeContext>) => Promise<T> | T,
    ): Promise<T> => {
      return await mw(currentCtx, options, (scopedCtx) => {
        return inner(makeRootRunContext(scopedCtx));
      });
    };

    return root.factory(makeRootRunContext(ctx as AmbientContext & ScopeContext));
  };
}
