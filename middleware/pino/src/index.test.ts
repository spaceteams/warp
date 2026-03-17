import type { Logger } from "pino";
import { expect, it, vi } from "vitest";
import { type LoggingOptions, pino } from ".";

type Ctx = { logger: Logger; additional: string };

it("threads context and result", async () => {
  const middleware = pino<Ctx>();

  const result = await middleware(
    { logger: {} as unknown as Logger, additional: "value" },
    {},
    (inner) => {
      expect(inner.additional).toEqual("value");
      expect(inner.logger).toEqual({});
      return 1;
    },
  );

  expect(result).toEqual(1);
});

it("sets child logger if requested", async () => {
  const middleware = pino();

  const child = vi.fn();
  const logger = { child } as unknown as Logger;

  await middleware({ logger }, {}, () => {});
  expect(child).not.toHaveBeenCalled();

  const options: LoggingOptions = {
    logging: { bindings: { userId: "string" }, options: { level: "error" } },
  };
  await middleware({ logger }, options, () => {});
  expect(child).toHaveBeenCalledWith(options.logging.bindings, options.logging.options);
});
