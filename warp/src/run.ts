import type { ComponentMeta } from "./component/component-meta";

export type WarpMeta = {
  component?: ComponentMeta;
  componentPath?: string;
};

export type Run<AmbientContext, ScopeContext = unknown, RunOptions = unknown> = AmbientContext & {
  run: <T>(
    options: RunOptions,
    inner: (app: Run<AmbientContext & ScopeContext, ScopeContext, RunOptions>) => Promise<T> | T,
  ) => Promise<T> | T;
  warp?: WarpMeta;
};
