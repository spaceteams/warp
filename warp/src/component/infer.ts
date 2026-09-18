import type { NoRunOptions, NoScopeContext } from "../middleware";
import type { ComponentFactory } from ".";
import type { ComponentMeta } from "./component-meta";

// Utility: Convert union to intersection
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

// Broad constraint: any callable with optional meta (matches all ComponentFactory variants).
// Uses `never` in contravariant (parameter) positions and `unknown` in covariant (return) position.
export type AnyFactory = ((...args: never[]) => unknown) & { meta?: ComponentMeta };

// These helpers match the structural ComponentFactory signature. Its original Ctx
// and Deps cannot always be recovered separately from their intersection; composition
// must preserve the actual factory input instead of reconstructing it from these types.
export type InferCtx<T> =
  T extends ComponentFactory<infer Ctx, infer _SC, infer _RO, infer _Deps, infer _Out>
    ? Ctx
    : unknown;

export type InferScopeContext<T> =
  T extends ComponentFactory<infer _Ctx, infer SC, infer _RO, infer _Deps, infer _Out>
    ? SC
    : NoScopeContext;

export type InferRunOptions<T> =
  T extends ComponentFactory<infer _Ctx, infer _SC, infer RO, infer _Deps, infer _Out>
    ? RO
    : NoRunOptions;

export type InferOut<T> = T extends (...args: never[]) => infer Out ? Out : never;
