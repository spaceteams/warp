import type { Component } from "../component";

export type ExplainResult = {
  name: string | undefined;
  kind?: string;
  tags?: string[];
  deps?: Record<string, ExplainResult>;
};
export const explain = <Ctx, ScopeCtx, RunOptions, Deps, Out>(
  c: Component<Ctx, ScopeCtx, RunOptions, Deps, Out>,
) => {
  const deps: Record<string, ExplainResult> = {};
  for (const [key, comp] of Object.entries(c.deps ?? {})) {
    deps[key] = explain(comp as Component<unknown, unknown, unknown, unknown, unknown>);
  }
  return {
    name: c.meta?.name,
    kind: c.meta?.kind,
    tags: c.meta?.tags,
    deps,
  };
};
