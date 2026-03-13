export type NoRunOptions = NonNullable<unknown>;
export type NoScopeContext = NonNullable<unknown>;

export type Middleware<AmbientContext, RunOptions = NoRunOptions, ScopeContext = NoScopeContext> = <
  T,
>(
  ctx: AmbientContext,
  options: Partial<RunOptions>,
  next: (ctx: AmbientContext & ScopeContext) => Promise<T> | T,
) => Promise<T> | T;
