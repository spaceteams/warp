import type { NoScopeContext } from "./middleware";

export type Run<AmbientContext, RunOptions, ScopeContext = NoScopeContext> = AmbientContext & {
  run: <T>(
    options: RunOptions,
    inner: (
      app: Run<AmbientContext & Partial<ScopeContext>, RunOptions, ScopeContext>,
    ) => Promise<T> | T,
  ) => Promise<T> | T;
};
