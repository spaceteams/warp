import { buildRuntime, type InferUsecase, usecaseFactory } from "@spaceteams/warp";
import { beforeEach, describe, expect, it } from "vitest";

// Lazy / heavy dependency example
//
// This example builds on the simple-service pattern and shows how components
// can defer creating expensive resources until they are actually needed.
// The heavyPdfClient factory increments a counter when constructed so tests
// can assert whether the heavy dependency was created or not.
//
// Key points for the reader (you already know the basics from simple-service):
// - Component factories are just functions. Returning an object from a factory
//   still gives you control over when that factory is invoked.
// - The runtime composes components but does not force creation of every
//   dependency eagerly — creation can be deferred to when the service actually
//   uses the dependency (lazy behavior).
let heavyCreated = 0;

const heavyPdfClient = () => {
  heavyCreated++;
  return {
    render: (content: string) => `pdf:${content}`,
  };
};

type HeavyPdfClient = ReturnType<typeof heavyPdfClient>;

type Deps = { heavyPdfClient: HeavyPdfClient };

const generatePreview = usecaseFactory<Deps, ["text" | "pdf"], string>(
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
type GeneratePreview = InferUsecase<typeof generatePreview>;

describe("lazy dependencies", () => {
  const { resolve, component } = buildRuntime().provide({});
  const graph = component(generatePreview, {
    heavyPdfClient: component(heavyPdfClient),
  });

  let generate: GeneratePreview;

  beforeEach(async () => {
    generate = await resolve(graph);
    heavyCreated = 0;
  });

  it("does not create heavy dependency when not needed", async () => {
    const result = await generate("text");
    expect(result).toEqual("plain-preview");
    // Assert that the heavy factory was never constructed.
    expect(heavyCreated).toBe(0);
  });

  it("creates heavy dependency when needed", async () => {
    const result = await generate("pdf");
    expect(result).toEqual("pdf:document");
    // Now the heavy factory should have been constructed once.
    expect(heavyCreated).toBe(1);
  });

  it("creates heavy dependency when needed", async () => {
    await generate("pdf");
    expect(heavyCreated).toBe(1);
  });
});
