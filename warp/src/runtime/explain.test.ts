import { expect, it } from "vitest";
import { usecaseFactory } from "../semantic/usecase-factory";
import { RuntimeBuilder } from "./runtime-builder";

const { component, explain } = new RuntimeBuilder().provide({ context: "1" });
const products = component(() => null, {}, { name: "ProductRepo" });
const prices = component(() => null, {});
const service = component(() => null, { products, prices }, { name: "MyService" });
const anotherService = component(() => null, { products });
const controller = component(
  usecaseFactory({ name: "MyController" }, () => async () => null),
  { service, anotherService, prices },
);

it("explains with ascii format", () => {
  const tree = explain(controller, "ascii");

  expect(tree).toMatchInlineSnapshot(`
    "└── MyController
        ├── [service]
        │       ├── [products]
        │       └── [prices]
        ├── [anotherService]
        │       └── [products]
        └── [prices]"
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
              "name": "ProductRepo",
            },
          },
          "name": undefined,
        },
        "prices": {
          "deps": {},
          "name": undefined,
        },
        "service": {
          "deps": {
            "prices": {
              "deps": {},
              "name": undefined,
            },
            "products": {
              "deps": {},
              "name": "ProductRepo",
            },
          },
          "name": "MyService",
        },
      },
      "name": "MyController",
    }
  `);
});

it("explains with mermaid format", () => {
  const mermaid = explain(controller, "mermaid");

  expect(mermaid).toMatchInlineSnapshot(`
    "graph TD
        MyController["MyController"]
        MyController_MyService["MyService"]
        MyController -->|service| MyController_MyService
        MyController_MyService -->|products| MyController_MyService_ProductRepo
        MyController_MyService_prices["prices"]
        MyController_MyService -->|prices| MyController_MyService_prices
        MyController_anotherService["anotherService"]
        MyController -->|anotherService| MyController_anotherService
        MyController_anotherService -->|products| MyController_anotherService_ProductRepo
        MyController_prices["prices"]
        MyController -->|prices| MyController_prices"
  `);
});
