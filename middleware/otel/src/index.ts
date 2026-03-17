import {
  type Attributes,
  type Context,
  type Meter,
  metrics,
  context as otelContext,
  type Span,
  SpanStatusCode,
  type Tracer,
  trace,
} from "@opentelemetry/api";
import type { Middleware, WarpMeta } from "@spaceteams/warp";

export type OtelRunOptions = {
  otel: {
    spanName?: string;
    attributes?: Attributes;
    recordMetrics?: boolean;
    recordErrors?: boolean;
  };
};
export type OtelAmbientContext = {
  otel?: {
    parentContext?: Context;
  };
};
export type OtelScopeContext = {
  span?: Span;
};
export type OtelMiddlewareConfig<
  AmbientContext,
  RunOptions extends OtelRunOptions = OtelRunOptions,
> = {
  instrumentationName: string;
  instrumentationVersion?: string;

  tracing?: boolean;
  metrics?: boolean;
  recordErrors?: boolean;

  tracer?: Tracer;
  meter?: Meter;

  metricNames?: {
    runs?: string;
    errors?: string;
    duration?: string;
  };

  metricAttributes?: (
    ctx: AmbientContext,
    options: Partial<RunOptions>,
    outcome: "ok" | "error",
  ) => Attributes | undefined;
};

export function otel<
  AmbientContext extends OtelAmbientContext,
  RunOptions extends OtelRunOptions = OtelRunOptions,
>(
  config: OtelMiddlewareConfig<AmbientContext, RunOptions>,
): Middleware<AmbientContext, RunOptions, OtelScopeContext> {
  const tracingEnabled = config.tracing ?? true;
  const metricsEnabled = config.metrics ?? true;
  const defaultRecordErrors = config.recordErrors ?? true;

  const tracer =
    config.tracer ?? trace.getTracer(config.instrumentationName, config.instrumentationVersion);

  const meter =
    config.meter ?? metrics.getMeter(config.instrumentationName, config.instrumentationVersion);

  const runsCounter = metricsEnabled
    ? meter.createCounter(config.metricNames?.runs ?? "warp.run.count", {
        description: "Number of warp run scopes completed",
      })
    : undefined;

  const errorsCounter = metricsEnabled
    ? meter.createCounter(config.metricNames?.errors ?? "warp.run.errors", {
        description: "Number of warp run scopes that failed",
      })
    : undefined;

  const durationHistogram = metricsEnabled
    ? meter.createHistogram(config.metricNames?.duration ?? "warp.run.duration", {
        description: "Duration of warp run scopes",
        unit: "ms",
      })
    : undefined;

  return async function otel<T>(
    ctx: AmbientContext,
    options: Partial<RunOptions>,
    next: (ctx: AmbientContext & OtelScopeContext) => Promise<T> | T,
    warp?: WarpMeta | undefined,
  ): Promise<T> {
    const runOtel = options.otel;
    if (!runOtel) {
      return await next(ctx as AmbientContext & OtelScopeContext);
    }

    const recordErrors = runOtel.recordErrors ?? defaultRecordErrors;
    const recordMetrics = runOtel.recordMetrics ?? metricsEnabled;

    const spanName = runOtel.spanName ?? warp?.componentPath ?? "warp.run";

    const attributes: Attributes = {
      componentPath: warp?.componentPath,
      componentKind: warp?.component?.kind,
      componentName: warp?.component?.name,
      ...runOtel.attributes,
    };

    const start = performance.now();

    const emitMetrics = (outcome: "ok" | "error") => {
      if (!recordMetrics) return;
      const metricAttrs = config.metricAttributes?.(ctx, options, outcome) ?? attributes;
      runsCounter?.add(1, metricAttrs);
      durationHistogram?.record(performance.now() - start, metricAttrs);
      if (outcome === "error") {
        errorsCounter?.add(1, metricAttrs);
      }
    };

    if (!tracingEnabled) {
      try {
        const result = await next(ctx as AmbientContext & OtelScopeContext);
        emitMetrics("ok");
        return result;
      } catch (error) {
        emitMetrics("error");
        throw error;
      }
    }

    const parentCtx = ctx.otel?.parentContext ?? otelContext.active();

    const span = tracer.startSpan(spanName, { attributes }, parentCtx);
    const activeCtx = trace.setSpan(parentCtx, span);

    try {
      return await otelContext.with(activeCtx, async () => {
        const scopedCtx = {
          ...ctx,
          span,
        } as AmbientContext & OtelScopeContext;

        const result = await next(scopedCtx);

        span.setStatus({ code: SpanStatusCode.OK });
        emitMetrics("ok");

        return result;
      });
    } catch (error) {
      if (recordErrors) {
        if (error instanceof Error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
        } else {
          span.recordException({ name: "NonErrorThrow", message: String(error) });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: String(error),
          });
        }
      }

      emitMetrics("error");

      throw error;
    } finally {
      span.end();
    }
  };
}
