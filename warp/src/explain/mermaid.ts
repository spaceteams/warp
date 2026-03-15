import type { ExplainResult } from ".";

const sanitizeMermaidId = (value: string): string => value.replace(/[^a-zA-Z0-9_]/g, "_");

const escapeMermaidLabel = (value: string): string => value.replace(/"/g, '\\"');

const formatMermaidLabel = (
  node: ExplainResult,
  showMeta: boolean,
  fallbackName: string,
): string => {
  let label = node.name ?? fallbackName;

  if (showMeta) {
    const metaParts: string[] = [];
    if (node.kind) metaParts.push(node.kind);
    if (node.tags?.length) metaParts.push(node.tags.join(", "));

    if (metaParts.length > 0) {
      label += `<br/>[${metaParts.join(" | ")}]`;
    }
  }

  return escapeMermaidLabel(label);
};

const collectMermaidLines = (
  node: ExplainResult,
  nodeId: string,
  showMeta: boolean,
  fallbackName: string,
): string[] => {
  const lines: string[] = [];

  lines.push(`    ${nodeId}["${formatMermaidLabel(node, showMeta, fallbackName)}"]`);

  const deps = Object.entries(node.deps ?? {});
  deps.forEach(([key, dep], index) => {
    const childBase = dep.name ?? key ?? `node_${index}`;
    const childId = sanitizeMermaidId(`${nodeId}__${key}__${childBase}`);

    lines.push(`    ${nodeId} -->|${escapeMermaidLabel(key)}| ${childId}`);
    lines.push(...collectMermaidLines(dep, childId, showMeta, key));
  });

  return lines;
};

export const toMermaid = (result: ExplainResult, showMeta = false): string => {
  const rootName = result.name ?? "root";
  const rootId = sanitizeMermaidId(rootName);

  return ["graph TD", ...collectMermaidLines(result, rootId, showMeta, rootName)].join("\n");
};
