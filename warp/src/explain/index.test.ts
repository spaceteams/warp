import { expect, it } from "vitest";
import { RuntimeBuilder } from "../runtime/runtime-builder";
import { repo, service } from "../semantic";
import { usecase } from "../semantic/usecase";

const { component, explain } = new RuntimeBuilder().provide({ context: "1" });
const products = component(repo({ name: "ProductRepo" }, () => null));
const prices = component(repo({ name: "PriceRepo", tags: ["database"] }, () => null));
const myService = component(
  service({ name: "MyService", tags: ["business-logic"] }, () => null),
  { products, prices },
);
const anotherService = component(() => null, { products });
const controller = component(
  usecase({ name: "MyController", tags: ["api", "public"] }, () => async () => null),
  { myService, anotherService, prices },
);

it("explains with ascii format", () => {
  const tree = explain(controller, "ascii");

  expect(tree).toMatchInlineSnapshot(`
    "└── MyController
        ├── myService
        │   ├── products
        │   └── prices
        ├── anotherService
        │   └── products
        └── prices"
  `);
});

it("explains with native format (default)", () => {
  expect(explain(controller)).toEqual(explain(controller, "native"));
  expect(explain(controller)).toMatchInlineSnapshot(`
    {
      "deps": {
        "anotherService": {
          "deps": {
            "products": {
              "deps": {},
              "kind": "repo",
              "name": "ProductRepo",
              "tags": undefined,
            },
          },
          "kind": undefined,
          "name": undefined,
          "tags": undefined,
        },
        "myService": {
          "deps": {
            "prices": {
              "deps": {},
              "kind": "repo",
              "name": "PriceRepo",
              "tags": [
                "database",
              ],
            },
            "products": {
              "deps": {},
              "kind": "repo",
              "name": "ProductRepo",
              "tags": undefined,
            },
          },
          "kind": "service",
          "name": "MyService",
          "tags": [
            "business-logic",
          ],
        },
        "prices": {
          "deps": {},
          "kind": "repo",
          "name": "PriceRepo",
          "tags": [
            "database",
          ],
        },
      },
      "kind": "usecase",
      "name": "MyController",
      "tags": [
        "api",
        "public",
      ],
    }
  `);
});

it("explains with mermaid format", () => {
  const mermaid = explain(controller, "mermaid");

  expect(mermaid).toMatchInlineSnapshot(`
    "graph TD
        MyController["MyController"]
        MyController -->|myService| MyController__myService__MyService
        MyController__myService__MyService["MyService"]
        MyController__myService__MyService -->|products| MyController__myService__MyService__products__ProductRepo
        MyController__myService__MyService__products__ProductRepo["ProductRepo"]
        MyController__myService__MyService -->|prices| MyController__myService__MyService__prices__PriceRepo
        MyController__myService__MyService__prices__PriceRepo["PriceRepo"]
        MyController -->|anotherService| MyController__anotherService__anotherService
        MyController__anotherService__anotherService["anotherService"]
        MyController__anotherService__anotherService -->|products| MyController__anotherService__anotherService__products__ProductRepo
        MyController__anotherService__anotherService__products__ProductRepo["ProductRepo"]
        MyController -->|prices| MyController__prices__PriceRepo
        MyController__prices__PriceRepo["PriceRepo"]"
  `);
});

it("includes kind and tags in native format", () => {
  const result = explain(controller, "native");

  // Check root component has kind and tags
  expect(result.kind).toBe("usecase");
  expect(result.tags).toEqual(["api", "public"]);

  // Check service has kind and tags
  expect(result.deps?.myService.kind).toBe("service");
  expect(result.deps?.myService.tags).toEqual(["business-logic"]);

  // Check repo has kind and tags
  expect(result.deps?.prices.kind).toBe("repo");
  expect(result.deps?.prices.tags).toEqual(["database"]);

  // Check nested repo has kind
  expect(result.deps?.myService.deps?.products.kind).toBe("repo");

  // Check component without metadata
  expect(result.deps?.anotherService.kind).toBeUndefined();
  expect(result.deps?.anotherService.tags).toBeUndefined();
});

it("explains component with tags", () => {
  const taggedRepo = component(
    repo({ name: "TaggedRepo", tags: ["cache", "redis", "fast"] }, () => null),
  );
  const result = explain(taggedRepo, "native");

  expect(result.name).toBe("TaggedRepo");
  expect(result.kind).toBe("repo");
  expect(result.tags).toEqual(["cache", "redis", "fast"]);
});

it("explains with ascii format showing metadata", () => {
  const tree = explain(controller, "ascii", true);

  expect(tree).toMatchInlineSnapshot(`
    "└── MyController [usecase] {api, public}
        ├── myService -> MyService [service] {business-logic}
        │   ├── products -> ProductRepo [repo]
        │   └── prices -> PriceRepo [repo] {database}
        ├── anotherService
        │   └── products -> ProductRepo [repo]
        └── prices -> PriceRepo [repo] {database}"
  `);
});

it("explains with mermaid format showing metadata", () => {
  const mermaid = explain(controller, "mermaid", true);
  expect(mermaid).toMatchInlineSnapshot(`
    "graph TD
        MyController["MyController<br/>[usecase | api, public]"]
        MyController -->|myService| MyController__myService__MyService
        MyController__myService__MyService["MyService<br/>[service | business-logic]"]
        MyController__myService__MyService -->|products| MyController__myService__MyService__products__ProductRepo
        MyController__myService__MyService__products__ProductRepo["ProductRepo<br/>[repo]"]
        MyController__myService__MyService -->|prices| MyController__myService__MyService__prices__PriceRepo
        MyController__myService__MyService__prices__PriceRepo["PriceRepo<br/>[repo | database]"]
        MyController -->|anotherService| MyController__anotherService__anotherService
        MyController__anotherService__anotherService["anotherService"]
        MyController__anotherService__anotherService -->|products| MyController__anotherService__anotherService__products__ProductRepo
        MyController__anotherService__anotherService__products__ProductRepo["ProductRepo<br/>[repo]"]
        MyController -->|prices| MyController__prices__PriceRepo
        MyController__prices__PriceRepo["PriceRepo<br/>[repo | database]"]"
  `);
});
