import {
  buildRuntime,
  client,
  type InferClient,
  type InferUsecase,
  usecase,
} from "@spaceteams/warp";
import { beforeEach, describe, expect, it } from "vitest";

// Lazy / heavy dependency example
//
// This example builds on the simple-service pattern and shows how components
// can defer creating expensive resources until they are actually needed.
// The heavyPdfClient factory increments a counter when constructed so tests
// can assert whether the heavy dependency was created or not.
let heavyCreated = 0;

const heavyPdfClient = client({ name: "heavy-client" }, () => {
  heavyCreated++;
  return {
    render: (content: string) => `pdf:${content}`,
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
type GeneratePreview = InferUsecase<typeof generatePreview>;

describe("lazy dependencies", () => {
  const { explain, resolve, component } = buildRuntime().provide({});
  const graph = component(generatePreview, {
    heavyPdfClient: component(heavyPdfClient),
  });

  let generate: GeneratePreview;

  beforeEach(async () => {
    generate = await resolve(graph);
    heavyCreated = 0;
  });

  it("can be explained", () => {
    expect(explain(graph, "ascii", true)).toMatchInlineSnapshot(`
        "└── generate-preview [usecase]
            └── heavyPdfClient -> heavy-client [client]"
      `);
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
