import type { Logger } from "pino";
import { expect, it, vi } from "vitest";
import { type LoggingOptions, pino } from ".";

it("threads context and result", async () => {
  const middleware = pino();

  const logger = {} as unknown as Logger;
  const result = await middleware({ logger }, {}, (ctx) => {
    expect(ctx).toEqual({ logger });
    return 1;
  });

  expect(result).toEqual(1);
});

it("sets child logger if requested", async () => {
  const middleware = pino();

  const child = vi.fn();
  const logger = { child } as unknown as Logger;

  await middleware({ logger }, {}, () => {});
  expect(child).not.toHaveBeenCalled();

  const options: LoggingOptions = {
    logger: { bindings: { userId: "string" }, options: { level: "error" } },
  };
  await middleware({ logger }, options, () => {});
  expect(child).toHaveBeenCalledWith(options.logger.bindings, options.logger.options);
});
