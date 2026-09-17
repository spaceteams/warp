import type { Logger } from "pino";
import { expect, it, vi } from "vitest";
import { type LoggingOptions, pino } from ".";

type Ctx = { logger: Logger; additional: string };

it("threads context and result", async () => {
  const middleware = pino<Ctx>();
  const child = vi.fn().mockReturnValue(42);
  const logger = { child } as unknown as Logger;

  const result = await middleware({ logger, additional: "value" }, {}, (inner) => {
    expect(inner.additional).toEqual("value");
    expect(inner.logger).toEqual(42);
    return 1;
  });

  expect(result).toEqual(1);
});

it("sets child logger", async () => {
  const middleware = pino();

  const child = vi.fn();
  const logger = { child } as unknown as Logger;

  const options: LoggingOptions = {
    logging: { bindings: { userId: "string" }, options: { level: "error" } },
  };
  await middleware({ logger }, options, () => {});
  expect(child).toHaveBeenCalledWith(options.logging?.bindings, options.logging?.options);
});
