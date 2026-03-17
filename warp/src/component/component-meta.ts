export type ComponentKind = "repo" | "service" | "usecase" | "client";

export type ComponentMeta = {
  name?: string;
  kind?: ComponentKind;
  tags?: string[];
};
