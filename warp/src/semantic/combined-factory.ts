import type { AnyFactory } from "../component";
import type { ComponentMeta } from "../component/component-meta";

// Validate after inferring the record, so AnyFactory's `never` parameters do not
// contextually infer `never` as the context of inline callable/usecase expressions.
export type ValidFactories<T> = {
  [K in keyof T]: T[K] extends AnyFactory ? T[K] : never;
};

// Infer from all factory signatures at once, without distributing over their union.
// Contravariant inference intersects inputs between factories while preserving unions
// within one input and treating context-free factories as having no requirements.
type CombinedInput<T extends Record<string, AnyFactory>> = T[keyof T] extends (
  ctx: infer Ctx,
) => unknown
  ? Ctx
  : never;

export type CombinedOutput<T extends Record<string, AnyFactory>> = {
  [K in keyof T]: ReturnType<T[K]>;
};

export type CombinedFactory<T extends Record<string, AnyFactory>> = ((
  ctx: CombinedInput<T>,
) => CombinedOutput<T>) & { meta?: ComponentMeta };
