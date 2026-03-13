import type { Middleware } from "@spaceteams/warp";
import type { Bindings, ChildLoggerOptions, Logger } from "pino";

export type LoggingOptions<ChildCustomLevels extends string = never> = {
  logger: {
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
  return async (ctx, options, next) => {
    const logger = options.logger
      ? ctx.logger.child(options.logger.bindings, options.logger.options)
      : ctx.logger;
    return await next({ ...ctx, logger });
  };
};
