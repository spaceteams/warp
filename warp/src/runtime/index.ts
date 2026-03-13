import { RuntimeBuilder } from "./runtime-builder";

export function buildRuntime(): RuntimeBuilder<Record<string, unknown>, unknown> {
  return new RuntimeBuilder();
}
