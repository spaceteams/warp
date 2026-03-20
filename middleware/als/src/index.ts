import { AsyncLocalStorage } from "node:async_hooks";
import type { Middleware } from "@spaceteams/warp";

export type AlsOptions<Ctx, ExposedCtx> = {
  als: {
    extract: (ctx: Ctx) => ExposedCtx;
  };
};
export type AlsCtx = NonNullable<unknown>;

export function createWarpAls<Ctx extends AlsCtx, ExposedCtx>() {
  const als = new AsyncLocalStorage<ExposedCtx>();

  return {
    middleware<Options extends AlsOptions<Ctx, ExposedCtx>>(): Middleware<Ctx, Options> {
      return async (ctx, hints, next) => {
        if (!hints.als) {
          return next(ctx);
        }
        const exposed = hints.als.extract(ctx);
        return als.run(exposed, () => next(ctx));
      };
    },
    getCtx: (): ExposedCtx | undefined => als.getStore(),
  };
}
