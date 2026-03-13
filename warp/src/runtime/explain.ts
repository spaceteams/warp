import type { Component } from "../component";

export type ExplainResult = { name: string | undefined; deps?: Record<string, ExplainResult> };
export const explain = <Ctx, RunOptions, Deps, Out>(c: Component<Ctx, RunOptions, Deps, Out>) => {
  const deps: Record<string, ExplainResult> = {};
  for (const [key, comp] of Object.entries(c.deps ?? {})) {
    deps[key] = explain(comp as Component<unknown, unknown, unknown, unknown>);
  }
  return {
    name: c.name,
    deps,
  };
};

export const toAsciiTree = (result: ExplainResult, prefix = "", isLast = true): string => {
  const lines: string[] = [];
  const connector = isLast ? "└── " : "├── ";
  lines.push(prefix + connector + result.name);

  const deps = Object.entries(result.deps ?? {});
  const newPrefix = prefix + (isLast ? "    " : "│   ");

  deps.forEach(([key, dep], index) => {
    const isLastDep = index === deps.length - 1;
    const connector = isLastDep ? "└── " : "├── ";
    lines.push(`${newPrefix}${connector}[${key}]`);
    const childPrefix = newPrefix + (isLastDep ? "    " : "│   ");
    const childLines = toAsciiTree(dep, childPrefix, true).split("\n").slice(1);
    lines.push(...childLines);
  });

  return lines.join("\n");
};

export const toMermaid = (result: ExplainResult, nodeId?: string, isRoot = true): string => {
  const lines: string[] = [];

  if (isRoot) {
    lines.push("graph TD");
    // For root node, use the name or "root" as the ID
    nodeId = result.name ?? "root";
  }

  const sanitizedId = nodeId!.replace(/[^a-zA-Z0-9_]/g, "_");

  if (isRoot) {
    lines.push(`    ${sanitizedId}["${result.name}"]`);
  }

  const deps = Object.entries(result.deps ?? {});
  deps.forEach(([key, dep]) => {
    const depNodeId = dep.name ? `${sanitizedId}_${dep.name}` : `${sanitizedId}_${key}`;
    const sanitizedDepId = depNodeId.replace(/[^a-zA-Z0-9_]/g, "_");
    const displayName = dep.name ?? key;

    lines.push(`    ${sanitizedDepId}["${displayName}"]`);
    lines.push(`    ${sanitizedId} -->|${key}| ${sanitizedDepId}`);

    const childLines = toMermaid(dep, sanitizedDepId, false).split("\n").slice(1);
    lines.push(...childLines);
  });

  return lines.join("\n");
};
