import type { WarpMeta } from "./run";

export type NoRunOptions = NonNullable<unknown>;
export type NoScopeContext = NonNullable<unknown>;

export type Middleware<AmbientContext, RunOptions = NoRunOptions, ScopeContext = NoScopeContext> = <
  T,
>(
  ctx: AmbientContext,
  options: Partial<RunOptions>,
  next: (ctx: AmbientContext & ScopeContext) => Promise<T> | T,
  warp?: WarpMeta | undefined,
) => Promise<T> | T;
