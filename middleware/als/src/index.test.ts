import { expect, it } from "vitest";
import { createWarpAls } from ".";

type Ctx = { additional: string };
type Exposed = { additionalExposed: number };

it("threads context and result", async () => {
  const warpAls = createWarpAls<Ctx, Exposed>();

  const result = await warpAls.middleware()({ additional: "value" }, {}, (inner) => {
    expect(inner.additional).toEqual("value");
    return 1;
  });

  expect(result).toEqual(1);
});

it("exposes context through mapper inside scopes", async () => {
  const warpAls = createWarpAls<Ctx, Exposed>();

  function legacyFunction() {
    expect(warpAls.getCtx()).toEqual({ additionalExposed: 1 });
  }

  await warpAls.middleware()(
    { additional: "1" },
    { als: { extract: (ctx) => ({ additionalExposed: Number(ctx.additional) }) } },
    (inner) => {
      expect(inner.additional).toEqual("1");
      legacyFunction();
      return 1;
    },
  );

  expect(warpAls.getCtx()).toBeUndefined();
});

it("only exposes context if mapper is available", async () => {
  const warpAls = createWarpAls<Ctx, Exposed>();

  function legacyFunction() {
    expect(warpAls.getCtx()).toBeUndefined();
  }

  await warpAls.middleware()({ additional: "1" }, {}, (inner) => {
    expect(inner.additional).toEqual("1");
    legacyFunction();
    return 1;
  });
});
