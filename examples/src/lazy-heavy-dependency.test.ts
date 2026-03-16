import { buildRuntime, client, type InferClient, usecase } from "@spaceteams/warp";
import { describe, expect, it, vi } from "vitest";

// Lazy / heavy dependency example
//
// This example builds on the simple-service pattern and shows how components
// can defer creating expensive resources until they are actually needed.
// The heavyPdfClient factory increments a counter when constructed so tests
// can assert whether the heavy dependency was created or not.

let heavyCreated = 0;

const heavyPdfClient = client({ name: "heavy-client" }, (ctx: { expensiveToken: string }) => {
  heavyCreated++;
  return {
    render: (content: string) => `pdf:${content} using ${ctx.expensiveToken}`,
  };
});
type HeavyPdfClient = InferClient<typeof heavyPdfClient>;

type Deps = { heavyPdfClient: HeavyPdfClient };

const generatePreview = usecase<Deps, ["text" | "pdf"], string>(
  { name: "generate-preview" },
  (ctx) => async (mode) => {
    if (mode === "text") {
      // When the 'text' branch is used, we never touch the heavy client.
      return "plain-preview";
    }
    // Only when 'pdf' is requested do we call into the heavy client.
    return ctx.heavyPdfClient.render("document");
  },
);

function setup() {
  heavyCreated = 0;
  const lazyContext = vi.fn(() => ({ expensiveToken: "expensive-token" }));
  const { explain, resolve, component } = buildRuntime().provideLazy(lazyContext);
  const graph = component(generatePreview, {
    heavyPdfClient: component(heavyPdfClient),
  });
  return { lazyContext, explain, resolve, graph };
}

describe("lazy dependencies", () => {
  it("can be explained", () => {
    const { explain, graph } = setup();
    expect(explain(graph, "ascii", true)).toMatchInlineSnapshot(`
        "└── generate-preview [usecase]
            └── heavyPdfClient -> heavy-client [client]"
      `);
  });

  it("does not create heavy dependency when not needed", async () => {
    const { lazyContext, resolve, graph } = setup();

    expect(lazyContext).not.toHaveBeenCalled();
    const generate = await resolve(graph);
    // Context is evaluated eagerly at resolve time…
    expect(lazyContext).toHaveBeenCalledTimes(1);

    const result = await generate("text");
    expect(result).toEqual("plain-preview");
    // …but the heavy client factory was never invoked.
    expect(heavyCreated).toBe(0);
  });

  it("creates heavy dependency exactly once when needed", async () => {
    const { lazyContext, resolve, graph } = setup();

    expect(lazyContext).not.toHaveBeenCalled();
    const generate = await resolve(graph);
    expect(lazyContext).toHaveBeenCalledTimes(1);

    const result = await generate("pdf");
    expect(result).toEqual("pdf:document using expensive-token");
    // The heavy client factory was constructed exactly once.
    expect(heavyCreated).toBe(1);
  });

  it("caches the lazy context across multiple resolves", async () => {
    const { lazyContext, resolve, graph } = setup();

    await resolve(graph);
    await resolve(graph);

    // provideLazy caches the factory result, so it is only called once
    // even when the runtime resolves multiple times.
    expect(lazyContext).toHaveBeenCalledTimes(1);
  });
});
