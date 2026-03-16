import { Lazy } from "../lazy";
import type { Middleware } from "../middleware";
import { Runtime } from "./runtime";

export class RuntimeBuilder<AmbientContext, ScopeContext = unknown, Options = unknown> {
  private readonly middlewares: Middleware<AmbientContext, Options, ScopeContext>[];

  constructor(middlewares: Middleware<AmbientContext, Options, ScopeContext>[] = []) {
    this.middlewares = middlewares;
  }

  use<A, S, H>(
    mw: Middleware<A, H, S>,
  ): RuntimeBuilder<AmbientContext & A, ScopeContext & S, Options & H> {
    const mws = [...this.middlewares, mw] as Middleware<
      AmbientContext & A,
      Options & H,
      ScopeContext & S
    >[];
    return new RuntimeBuilder(mws);
  }

  provide<ActualCtx extends AmbientContext>(ctx: ActualCtx) {
    return new Runtime<AmbientContext, ActualCtx, ScopeContext, Options>(
      this.buildMiddleware(),
      () => ctx,
    );
  }
  provideLazy<ActualCtx extends AmbientContext>(ctx: () => ActualCtx) {
    return new Runtime<AmbientContext, ActualCtx, ScopeContext, Options>(
      this.buildMiddleware(),
      Lazy.cached(ctx),
    );
  }

  private buildMiddleware(): Middleware<AmbientContext, Options, ScopeContext> {
    const middlewares = this.middlewares;
    return function composed<T>(
      ctx: AmbientContext,
      options: Partial<Options>,
      next: (ctx: ScopeContext & AmbientContext) => Promise<T> | T,
    ): Promise<T> | T {
      let index = -1;

      const dispatch = (i: number, currentCtx: AmbientContext): Promise<T> | T => {
        if (i <= index) {
          throw new Error("next() called multiple times");
        }
        index = i;

        const mw = middlewares[i];
        if (!mw) {
          return next(currentCtx as ScopeContext & AmbientContext);
        }

        return mw(currentCtx, options, (nextCtx: ScopeContext & AmbientContext) =>
          dispatch(i + 1, nextCtx),
        );
      };

      return dispatch(0, ctx);
    };
  }
}
