import type { AnyFactory, InferOut } from "../component";
import type { ComponentMeta } from "../component/component-meta";
import type { Run } from "../run";
import type { CombinedFactory, CombinedOutput, ValidFactories } from "./combined-factory";

export type ServiceOutput<T extends Record<string, AnyFactory>> = CombinedOutput<T>;

type AnyFn = (...args: unknown[]) => unknown;

/**
 * Creates a service component factory that bundles multiple method factories into
 * a single component with `kind: "service"`.
 *
 * Each value in the record should be a function `(ctx) => (...args) => result`.
 * Methods are bound **lazily** (only when first invoked) and each invocation
 * triggers `ctx.run(...)` so that middleware fires for every call.
 *
 * @param options - Component metadata (name, tags) plus any run options that
 *   are forwarded to every method invocation. `kind` is automatically set to "service".
 * @param factories - Record of named method factories.
 *
 * @example
 * ```ts
 * const pricingService = service({ name: "pricing-service" }, {
 *   calculate: (ctx) => async (productId: string) => ctx.priceRepo.get(productId) * 1.19,
 * });
 * ```
 */
export function service<const T extends Record<string, unknown>, RunOptions = unknown>(
  options: RunOptions & Omit<ComponentMeta, "kind">,
  factories: T & ValidFactories<T>,
): CombinedFactory<ValidFactories<T>> & {
  meta: { kind: "service"; name?: string; tags?: string[] };
} {
  const kind = "service" as const;

  const factory = (ctx: Run<unknown, unknown, unknown>) => {
    const result: Record<string, AnyFn> = {};

    for (const [key, fn] of Object.entries(factories)) {
      let bound: AnyFn | undefined;

      result[key] = (...args: unknown[]) => {
        if (!bound) {
          bound = (fn as AnyFn)(ctx) as AnyFn;
        }

        const isRoot = ctx.warp?.component?.name === key && ctx.warp?.component?.kind === kind;
        const prefix = isRoot ? undefined : (ctx.warp?.componentPath ?? ctx.warp?.component?.name);
        const warpMeta = {
          component: { kind, name: key, tags: options.tags },
          componentPath: prefix ? `${prefix}.${key}` : undefined,
          componentKey: key,
        };

        return ctx.run(options, () => bound!(...args), warpMeta);
      };
    }

    return result;
  };

  Object.assign(factory, {
    meta: {
      kind,
      name: options.name,
      tags: options.tags,
    },
  });

  return factory as unknown as CombinedFactory<ValidFactories<T>> & {
    meta: { kind: "service"; name?: string; tags?: string[] };
  };
}

export type InferService<T> = InferOut<T>;
