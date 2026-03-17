import type { Middleware } from "@spaceteams/warp";
import type { Bindings, ChildLoggerOptions, Logger } from "pino";

export type LoggingOptions<ChildCustomLevels extends string = never> = {
  logging: {
    bindings: Bindings;
    options?: ChildLoggerOptions<ChildCustomLevels>;
  };
};
export type LoggingCtx = {
  logger: Logger;
};
export const pino = <
  Ctx extends LoggingCtx,
  ChildCustomLevels extends string = never,
>(): Middleware<Ctx, LoggingOptions<ChildCustomLevels>> => {
  return async (ctx, options, next, warp) => {
    if (!options.logging) {
      return next(ctx);
    }
    const logger = ctx.logger.child(
      {
        componentPath: warp?.componentPath,
        component: warp?.component,
        ...options.logging.bindings,
      },
      options.logging.options,
    );
    return await next({ ...ctx, logger });
  };
};
