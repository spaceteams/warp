import { buildRuntime, type ComponentMeta, repo, usecase } from "@spaceteams/warp";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Realistic use case
//
// This example demonstrates a few practical patterns that build on the
// simple-service example:
// - Using a class-based component with dependencies injected via constructor.
// - Declaring a default runtime configuration and then overriding individual
//   values per-test via `.with(...)`.
// - Passing real runtime values like logger and userId into components.
// - Keeping factories small (e.g. `customerRepo`) and composing them with
//   higher-level services (e.g. `PricingService`).
// - use of the semantic helpers 'repo' and 'service' and explaining a graph
type Ctx = {
  userId: string;
  logger: { info: (msg: string) => void };
  config: { pricingMode: "gross" | "net" };
};

const customerRepo = repo(
  { name: "customer-repo", tags: ["customer"] },
  () => (customerId: string) => ({
    id: customerId,
    active: true,
  }),
);
type CustomerRepo = ReturnType<typeof customerRepo>;

const priceRepo = repo({ name: "price-repo" }, () => (_productId: string) => 100);
type PriceRepo = ReturnType<typeof priceRepo>;

class PricingService {
  // classes can communicate meta information via static members
  static meta: ComponentMeta = {
    name: "price-service",
    kind: "service" as const,
  };

  // The class receives only the part of the context it needs. We use `Pick`
  // to highlight that a class can be typed to its required slice of context.
  constructor(private readonly ctx: Pick<Ctx, "config"> & { priceRepo: PriceRepo }) {}

  calculate(productId: string) {
    const basePrice = this.ctx.priceRepo(productId);
    return this.ctx.config.pricingMode === "gross" ? basePrice * 1.19 : basePrice;
  }
}

// creating a more complex usecase can be made more readable by pulling out type defintions
type UseCaseDeps = {
  customerRepo: CustomerRepo;
  pricingService: PricingService;
};
type Offer = {
  customerId: string;
  price: number;
  createdBy: string;
};
const createOffer = usecase<Ctx & UseCaseDeps, [string, string], Offer>(
  { name: "create-offer" },
  (ctx) => async (customerId, productId) => {
    const customer = ctx.customerRepo(customerId);
    if (!customer.active) {
      throw new Error("inactive customer");
    }

    const price = ctx.pricingService.calculate(productId);
    ctx.logger.info(`user ${ctx.userId} created offer for ${customerId}`);

    return {
      customerId,
      price,
      createdBy: ctx.userId,
    };
  },
);

describe("realistic usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // build a runtime:
  // - provide ambient context (e.g. logger)
  // - require some request context when resolving (userId, config)
  const info = vi.fn();
  const { explain, resolve, component, classComponent } = buildRuntime()
    .provide({
      logger: { info },
    })
    .require<{
      userId: string;
      config: { pricingMode: "gross" | "net" };
    }>();

  // use the component and classComponent methods from the runtime to wire togher the execution graph
  const graph = component(createOffer, {
    customerRepo: component(customerRepo),
    pricingService: classComponent(PricingService, {
      priceRepo: component(priceRepo),
    }),
  });

  it("can be explained", () => {
    expect(explain(graph, "ascii", true)).toMatchInlineSnapshot(`
      "└── create-offer [usecase]
          ├── customerRepo -> customer-repo [repo] {customer}
          └── pricingService -> price-service [service]
              └── priceRepo -> price-repo [repo]"
    `);
  });

  it("calculates gross price", async () => {
    const serviceInstance = await resolve(graph, {
      userId: "current-user",
      config: { pricingMode: "gross" },
    });

    const calculation = await serviceInstance("customer-1", "product-1");
    expect(calculation).toEqual({
      createdBy: "current-user",
      customerId: "customer-1",
      price: 119,
    });
    expect(info).toHaveBeenCalledWith("user current-user created offer for customer-1");
  });

  it("calculates net price", async () => {
    const serviceInstance = await resolve(graph, {
      userId: "current-user",
      config: { pricingMode: "net" },
    });

    const calculation = await serviceInstance("customer-2", "product-1");
    expect(calculation).toEqual({
      createdBy: "current-user",
      customerId: "customer-2",
      price: 100,
    });
    expect(info).toHaveBeenCalledWith("user current-user created offer for customer-2");
  });
});
