import { expect, it } from "vitest";
import { buildRuntime } from "../runtime";

it("does not cache accros resolves", async () => {
  const { resolve, component } = buildRuntime().provide({ resource: "some-resource" });
  let instantiated = 0;
  const graph = component((ctx) => {
    instantiated++;
    expect(ctx).toMatchObject({ resource: "some-resource" });
    return () => instantiated;
  });

  const callable = await resolve(graph);
  expect(instantiated).toEqual(1);
  callable();
  expect(instantiated).toEqual(1);

  const otherCallable = await resolve(graph);
  expect(instantiated).toEqual(2);
  otherCallable();
  expect(instantiated).toEqual(2);
});
