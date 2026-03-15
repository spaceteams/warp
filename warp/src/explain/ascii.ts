import type { ExplainResult } from ".";

const formatExplainLabel = (node: ExplainResult, showMeta: boolean, edgeLabel?: string): string => {
  let label = edgeLabel ?? node.name ?? "unnamed";

  if (edgeLabel && showMeta && node.name) {
    label += ` -> ${node.name}`;
  }

  if (showMeta && node.kind) {
    label += ` [${node.kind}]`;
  }

  if (showMeta && node.tags?.length) {
    label += ` {${node.tags.join(", ")}}`;
  }

  return label;
};

export const toAsciiTree = (
  result: ExplainResult,
  prefix = "",
  isLast = true,
  showMeta = false,
  edgeLabel?: string,
): string => {
  const connector = isLast ? "└── " : "├── ";
  const line = `${prefix}${connector}${formatExplainLabel(result, showMeta, edgeLabel)}`;

  const deps = Object.entries(result.deps ?? {});
  if (deps.length === 0) {
    return line;
  }

  const childPrefix = prefix + (isLast ? "    " : "│   ");

  const children = deps.map(([key, dep], index) =>
    toAsciiTree(dep, childPrefix, index === deps.length - 1, showMeta, key),
  );

  return [line, ...children].join("\n");
};
