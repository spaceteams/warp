import { expect, it } from "vitest";
import { buildRuntime } from "../runtime";
import { client } from "../semantic";

it("caches across resolves", async () => {
  const { resolve, singleton } = buildRuntime().provide({ resource: "some-resource" });
  let instantiated = 0;
  const graph = singleton((ctx) => {
    instantiated++;
    expect(ctx).toMatchObject({ resource: "some-resource" });
    return () => "called";
  });

  const callable = await resolve(graph);
  expect(instantiated).toEqual(1);
  callable();
  expect(instantiated).toEqual(1);

  const otherCallable = await resolve(graph);
  expect(instantiated).toEqual(1);
  otherCallable();
  expect(instantiated).toEqual(1);
});

it("caches per singleton instance", async () => {
  const { resolve, singleton, component } = buildRuntime().provide({ resource: "some-resource" });

  const instantiated = { shared: 0, singleton: 0 };
  const mySingleton = client({}, (ctx) => {
    if (ctx.warp?.componentKey === "shared") {
      instantiated.shared++;
    } else {
      instantiated.singleton++;
    }
    return () => "called";
  });

  const shared = singleton(mySingleton);
  const component1 = component(
    (ctx) => {
      // trigger dependencies (they are lazy!)
      void ctx.shared;
      void ctx.nested;
    },
    {
      shared,
      nested: component(
        (ctx) => {
          void ctx.singleton;
          void ctx.shared;
        },
        {
          singleton: singleton(mySingleton),
          shared,
        },
      ),
    },
  );
  await resolve(component1);

  expect(instantiated).toEqual({ shared: 1, singleton: 1 });
});
