import { buildRuntime } from "@spaceteams/warp";
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
//
// If you understand the simple example, focus on:
// - `classComponent` usage (here we use the runtime helper that creates a
//   class instance when the component is resolved).
// - How `defaultRuntime.with({...})` is reused across tests and how further
//   per-test `.with({...})` calls override values for a single test.
type Ctx = {
  userId: string;
  logger: { info: (msg: string) => void };
  config: { pricingMode: "gross" | "net" };
};

const customerRepo = () => (customerId: string) => ({
  id: customerId,
  active: true,
});
type CustomerRepo = ReturnType<typeof customerRepo>;

const priceRepo = () => (_productId: string) => 100;
type PriceRepo = ReturnType<typeof priceRepo>;

class PricingService {
  // The class receives only the part of the context it needs. We use `Pick`
  // to highlight that a class can be typed to its required slice of context.
  constructor(private readonly ctx: Pick<Ctx, "config"> & { priceRepo: PriceRepo }) {}

  calculate(productId: string) {
    const basePrice = this.ctx.priceRepo(productId);
    return this.ctx.config.pricingMode === "gross" ? basePrice * 1.19 : basePrice;
  }
}

type UseCaseDeps = {
  customerRepo: CustomerRepo;
  pricingService: PricingService;
};

const createOffer = (ctx: Ctx & UseCaseDeps) => (customerId: string, productId: string) => {
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
};

describe("realistic usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Create a default runtime with some global defaults (e.g. config).
  // Tests then call `.provide({...})` to provide ambient context
  // and require each request (test) to define userId and config.
  const info = vi.fn();
  const { resolve, component, classComponent } = buildRuntime()
    .provide({
      logger: { info },
    })
    .require<{
      userId: string;
      config: { pricingMode: "gross" | "net" };
    }>();

  const graph = component(createOffer, {
    customerRepo: component(customerRepo),
    pricingService: classComponent(PricingService, {
      priceRepo: component(priceRepo),
    }),
  });

  it("calculates gross price", async () => {
    const serviceInstance = await resolve(graph, {
      userId: "current-user",
      config: { pricingMode: "gross" },
    });

    const calculation = serviceInstance("customer-1", "product-1");
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

    const calculation = serviceInstance("customer-2", "product-1");
    expect(calculation).toEqual({
      createdBy: "current-user",
      customerId: "customer-2",
      price: 100,
    });
    expect(info).toHaveBeenCalledWith("user current-user created offer for customer-2");
  });
});
