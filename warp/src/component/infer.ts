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

// Extract type parameters using positional generic alias inference on ComponentFactory.
// TypeScript recognizes Callable/Repo/Service/Client as ComponentFactory instances
// and can infer the type arguments positionally without expanding the alias.
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

export type InferOut<T> =
  T extends ComponentFactory<infer _Ctx, infer _SC, infer _RO, infer _Deps, infer Out>
    ? Out
    : never;
