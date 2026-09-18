import type { AnyFactory, InferOut } from "../component";
import type { ComponentMeta } from "../component/component-meta";
import type { CombinedFactory, CombinedOutput, ValidFactories } from "./combined-factory";

export type ServiceOutput<T extends Record<string, AnyFactory>> = CombinedOutput<T>;

/**
 * Creates a service component factory that bundles multiple factories into
 * a single component with `kind: "service"`.
 *
 * Each value in the record should typically be a `callable` or `usecase` so
 * that middleware fires when the method is invoked. Plain functions can also
 * be used, but they will not trigger middleware.
 *
 * @param options - Component metadata (name, tags). `kind` is automatically set to "service".
 * @param factories - Record of named factories to bundle.
 *
 * @example
 * ```ts
 * const pricingService = service({ name: "pricing-service" }, {
 *   calculate: callable({ name: "calculate" }, (ctx) => async (productId: string) => {
 *     return ctx.priceRepo.get(productId) * 1.19;
 *   }),
 * });
 * ```
 */
export function service<const T extends Record<string, unknown>>(
  options: Omit<ComponentMeta, "kind">,
  factories: T & ValidFactories<T>,
): CombinedFactory<ValidFactories<T>> & {
  meta: { kind: "service"; name?: string; tags?: string[] };
} {
  const factory = (ctx: unknown) => {
    const result: Record<string, unknown> = {};
    for (const [key, f] of Object.entries(factories)) {
      result[key] = (f as (ctx: unknown) => unknown)(ctx);
    }
    return result;
  };
  Object.assign(factory, {
    meta: {
      kind: "service" as const,
      name: options.name,
      tags: options.tags,
    },
  });
  return factory as CombinedFactory<ValidFactories<T>> & {
    meta: { kind: "service"; name?: string; tags?: string[] };
  };
}

export type InferService<T> = InferOut<T>;
