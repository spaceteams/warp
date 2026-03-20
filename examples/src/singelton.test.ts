import {
  buildRuntime,
  client,
  type InferClient,
  type InferService,
  service,
  usecase,
} from "@spaceteams/warp";
import { expect, it } from "vitest";

// Singletons
//
// Singletons are components that cache their factory outputs. This means they can be used multiple times
// inside a graph and are even cached accross graphs or even runtimes (given that the contexts are compatible).
//
// As an alternative to a singleton you can also
//  - add the dependency as is (see the 'test-overrides' example)
//  - rely on lazy resolution
//  - put the dependency into the (lazy) ambient context
// but those have different semantics.
//
// (1) Putting a dependency as is inside the graph means you have to instantiate it yourself and don't get
// access to the context. (2) Relying on lazy resolution helps if you don't want to instantiate conditionally
// and only once per run scope. (3) Put dependencies also means you have to instiate it yourself, but you make
// them visible globally and allow any component to depend on it without having to explicitly wire it.
//
// But if you just don't want your dependency to be instiated multiple times and don't need scoped semantics:
// Use Singletons!
const { explain, resolve, singleton, component } = buildRuntime().provide({
  resource: "some-resource",
});

// the singleton instance detects whether it is keyed as "shared" and counts instantiations accordingly
const instantiated = { shared: 0, singleton: 0 };
const mySingleton = client({}, (ctx) => {
  if (ctx.warp?.componentKey === "shared") {
    instantiated.shared++;
  } else {
    instantiated.singleton++;
  }
  return () => "called";
});
type MySingleton = InferClient<typeof mySingleton>;

// let's define a service and a usecase that depend on the singleton in multiple places.
const nestedService = service<{ singleton: MySingleton; shared: MySingleton }, () => string>(
  { name: "NestedService " },
  (ctx) => () => {
    ctx.singleton();
    ctx.shared();
    return "called";
  },
);
const rootUsecase = usecase<
  { shared: MySingleton; nested: InferService<typeof nestedService> },
  [],
  string
>({ name: "RooUsecase " }, (ctx) => async () => {
  ctx.shared();
  ctx.nested();
  return "called";
});

// now we put them together. We reuse one singled called 'shared' in multiple places.
const shared = singleton(mySingleton);
const nested = component(nestedService, {
  singleton: singleton(mySingleton),
  shared,
});
const graph = component(rootUsecase, { shared, nested }, { name: "my-graph" });

// we resolve this graph
const resolved = await resolve(graph);

// now we can even reuse the 'shared' singleton in another component graph
const graph2 = component(
  (ctx) => {
    return () => {
      // trigger dependencies (they are lazy!)
      return ctx.shared();
    };
  },
  {
    shared,
  },
  { name: "my-graph-2" },
);
const resolved2 = await resolve(graph2);

it("can be explained", () => {
  expect(explain(graph, "ascii", true)).toMatchInlineSnapshot(`
    "└── my-graph [usecase]
        ├── shared [client]
        └── nested -> NestedService  [service]
            ├── singleton [client]
            └── shared [client]"
  `);
  expect(explain(graph2, "ascii", true)).toMatchInlineSnapshot(`
    "└── my-graph-2
        └── shared [client]"
  `);
});

it("caches per singleton instance", async () => {
  // dependencies are evaluated when calling the usecase
  expect(instantiated).toEqual({ shared: 0, singleton: 0 });
  await resolved();
  expect(instantiated).toEqual({ shared: 1, singleton: 1 });
  resolved2();
  expect(instantiated).toEqual({ shared: 1, singleton: 1 });
});
