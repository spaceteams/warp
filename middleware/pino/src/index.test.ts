import { buildRuntime, usecase } from "@spaceteams/warp";
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

it("uses meta", async () => {
  const info = vi.fn();
  const child = vi.fn().mockReturnValue({ info } as unknown as Logger);
  const logger = { child } as unknown as Logger;
  const { resolve, component } = buildRuntime().use(pino()).provide({ logger });
  const customerUsecase = usecase(
    { name: "customer-usecase" },
    (ctx: { logger: Logger }) => async () => {
      ctx.logger.info("called");
    },
  );
  const call = await resolve(component(customerUsecase));
  call();
  expect(child).toHaveBeenCalledWith(
    {
      component: { kind: "usecase", name: "customer-usecase" },
      componentPath: undefined,
    },
    undefined,
  );
  expect(info).toHaveBeenCalledWith("called");
});
