import { context as otelContext, SpanStatusCode, trace } from "@opentelemetry/api";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { describe, expect, it } from "vitest";
import { type OtelAmbientContext, otel } from ".";

type Ctx = { additional: string } & OtelAmbientContext;

// Test helpers
function setupOtelTestEnvironment() {
  const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 100,
  });
  const meterProvider = new MeterProvider({ readers: [metricReader] });

  const spanExporter = new InMemorySpanExporter();
  const tracerProvider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(spanExporter)],
  });

  const tracer = tracerProvider.getTracer("my-app");
  const meter = meterProvider.getMeter("my-app");

  return {
    metricExporter,
    metricReader,
    meterProvider,
    spanExporter,
    tracerProvider,
    tracer,
    meter,
  };
}

async function collectMetrics(
  metricReader: PeriodicExportingMetricReader,
  metricExporter: InMemoryMetricExporter,
) {
  await metricReader.forceFlush();
  const resourceMetrics = metricExporter.getMetrics();
  if (resourceMetrics.length === 0) return [];

  const scopeMetrics = resourceMetrics[0].scopeMetrics;
  if (scopeMetrics.length === 0) return [];

  return scopeMetrics[0].metrics;
}

async function collectSpans(spanExporter: InMemorySpanExporter) {
  await spanExporter.forceFlush();
  return spanExporter.getFinishedSpans();
}

function findMetric(metrics: any[], name: string) {
  return metrics.find((m) => m.descriptor.name === name);
}

describe("otel middleware", () => {
  it("threads context and result", async () => {
    const middleware = otel<Ctx>({ instrumentationName: "my-app" });

    const result = await middleware({ additional: "value" }, {}, (inner) => {
      expect(inner.additional).toEqual("value");
      return 1;
    });

    expect(result).toEqual(1);
  });

  it("skips otel when otel options not provided", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    const result = await middleware({ additional: "value" }, {}, (inner) => {
      expect(inner.span).toBeUndefined();
      return 42;
    });

    expect(result).toEqual(42);

    const spans = await collectSpans(env.spanExporter);
    expect(spans).toHaveLength(0);
  });

  it("creates span with custom name and attributes", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    await middleware(
      { additional: "value", otel: {} },
      {
        otel: {
          spanName: "test-operation",
          attributes: { customAttr: "customValue" },
        },
      },
      (inner) => {
        expect(inner.span?.spanContext().spanId).toBeDefined();
      },
      {
        componentPath: "products.service",
        component: {
          name: "ProductService",
          kind: "service",
          tags: ["product"],
        },
      },
    );

    const spans = await collectSpans(env.spanExporter);
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe("test-operation");
    expect(spans[0].attributes).toMatchObject({
      componentPath: "products.service",
      componentKind: "service",
      componentName: "ProductService",
      customAttr: "customValue",
    });
    expect(spans[0].status.code).toBe(SpanStatusCode.OK);
  });

  it("uses component path as default span name", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    await middleware({ additional: "value", otel: {} }, { otel: {} }, () => {}, {
      componentPath: "orders.controller",
    });

    const spans = await collectSpans(env.spanExporter);
    expect(spans[0].name).toBe("orders.controller");
  });

  it("uses 'warp.run' as fallback span name", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    await middleware({ additional: "value", otel: {} }, { otel: {} }, () => {});

    const spans = await collectSpans(env.spanExporter);
    expect(spans[0].name).toBe("warp.run");
  });

  it("records metrics with correct attributes", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    await middleware(
      { additional: "value", otel: {} },
      { otel: { spanName: "test-span" } },
      () => {},
      {
        componentPath: "products.service",
        component: {
          name: "ProductService",
          kind: "service",
          tags: ["product"],
        },
      },
    );

    const collectedMetrics = await collectMetrics(env.metricReader, env.metricExporter);

    const runsMetric = findMetric(collectedMetrics, "warp.run.count");
    expect(runsMetric).toBeDefined();
    expect(runsMetric.descriptor.description).toBe("Number of warp run scopes completed");
    expect(runsMetric.dataPoints[0].value).toBe(1);
    expect(runsMetric.dataPoints[0].attributes).toMatchObject({
      componentPath: "products.service",
      componentKind: "service",
      componentName: "ProductService",
    });

    const durationMetric = findMetric(collectedMetrics, "warp.run.duration");
    expect(durationMetric).toBeDefined();
    expect(durationMetric.descriptor.description).toBe("Duration of warp run scopes");
    expect(durationMetric.descriptor.unit).toBe("ms");
    // Histogram data points have a value object with sum, count, min, max
    expect(durationMetric.dataPoints[0].value.sum).toBeGreaterThanOrEqual(0);
  });

  it("records error metrics and span status on error", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    const testError = new Error("test error");

    await expect(
      middleware(
        { additional: "value", otel: {} },
        { otel: { spanName: "failing-operation" } },
        () => {
          throw testError;
        },
      ),
    ).rejects.toThrow("test error");

    const spans = await collectSpans(env.spanExporter);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
    expect(spans[0].status.message).toBe("test error");
    expect(spans[0].events).toHaveLength(1);
    expect(spans[0].events[0].name).toBe("exception");

    const collectedMetrics = await collectMetrics(env.metricReader, env.metricExporter);
    const errorsMetric = findMetric(collectedMetrics, "warp.run.errors");
    expect(errorsMetric).toBeDefined();
    expect(errorsMetric.dataPoints[0].value).toBe(1);
  });

  it("records non-Error throws", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    await expect(
      middleware({ additional: "value", otel: {} }, { otel: {} }, () => {
        throw "string error";
      }),
    ).rejects.toBe("string error");

    const spans = await collectSpans(env.spanExporter);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
    expect(spans[0].status.message).toBe("string error");
    expect(spans[0].events[0].attributes).toMatchObject({
      "exception.type": "NonErrorThrow",
      "exception.message": "string error",
    });
  });

  it("skips error recording when recordErrors is false", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    await expect(
      middleware({ additional: "value", otel: {} }, { otel: { recordErrors: false } }, () => {
        throw new Error("test error");
      }),
    ).rejects.toThrow("test error");

    const spans = await collectSpans(env.spanExporter);
    expect(spans[0].events).toHaveLength(0);
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
  });

  it("disables tracing when tracing config is false", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracing: false,
      tracer: env.tracer,
      meter: env.meter,
    });

    await middleware(
      { additional: "value", otel: {} },
      { otel: { spanName: "test-span" } },
      (inner) => {
        expect(inner.span).toBeUndefined();
      },
    );

    const spans = await collectSpans(env.spanExporter);
    expect(spans).toHaveLength(0);

    // Metrics should still be recorded
    const collectedMetrics = await collectMetrics(env.metricReader, env.metricExporter);
    expect(collectedMetrics.length).toBeGreaterThan(0);
  });

  it("disables metrics when metrics config is false", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      metrics: false,
      tracer: env.tracer,
      meter: env.meter,
    });

    await middleware({ additional: "value", otel: {} }, { otel: {} }, () => {});

    const collectedMetrics = await collectMetrics(env.metricReader, env.metricExporter);
    expect(collectedMetrics).toHaveLength(0);

    // Tracing should still work
    const spans = await collectSpans(env.spanExporter);
    expect(spans).toHaveLength(1);
  });

  it("skips metrics when recordMetrics is false in run options", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    await middleware(
      { additional: "value", otel: {} },
      { otel: { recordMetrics: false } },
      () => {},
    );

    const collectedMetrics = await collectMetrics(env.metricReader, env.metricExporter);

    // All metrics should be skipped when recordMetrics is false
    expect(collectedMetrics).toHaveLength(0);
  });

  it("uses custom metric names", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
      metricNames: {
        runs: "custom.runs",
        errors: "custom.errors",
        duration: "custom.duration",
      },
    });

    await middleware({ additional: "value", otel: {} }, { otel: {} }, () => {});

    const collectedMetrics = await collectMetrics(env.metricReader, env.metricExporter);

    expect(findMetric(collectedMetrics, "custom.runs")).toBeDefined();
    expect(findMetric(collectedMetrics, "custom.duration")).toBeDefined();
  });

  it("uses custom metric attributes function", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
      metricAttributes: (ctx, options, outcome) => ({
        customAttr: ctx.additional,
        outcome,
        hasSpanName: !!options.otel?.spanName,
      }),
    });

    await middleware(
      { additional: "test-value", otel: {} },
      { otel: { spanName: "custom-span" } },
      () => {},
    );

    const collectedMetrics = await collectMetrics(env.metricReader, env.metricExporter);
    const runsMetric = findMetric(collectedMetrics, "warp.run.count");

    expect(runsMetric.dataPoints[0].attributes).toMatchObject({
      customAttr: "test-value",
      outcome: "ok",
      hasSpanName: true,
    });
  });

  it("applies custom metric attributes on error", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
      metricAttributes: (_ctx, _options, outcome) => ({
        outcome,
        errorType: outcome === "error" ? "test" : undefined,
      }),
    });

    await expect(
      middleware({ additional: "value", otel: {} }, { otel: {} }, () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow();

    const collectedMetrics = await collectMetrics(env.metricReader, env.metricExporter);
    const errorsMetric = findMetric(collectedMetrics, "warp.run.errors");

    expect(errorsMetric.dataPoints[0].attributes).toMatchObject({
      outcome: "error",
      errorType: "test",
    });
  });

  it("respects parent context", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    const parentSpan = env.tracer.startSpan("parent-span");
    const parentContext = trace.setSpan(otelContext.active(), parentSpan);
    const parentSpanId = parentSpan.spanContext().spanId;
    const parentTraceId = parentSpan.spanContext().traceId;

    await middleware(
      { additional: "value", otel: { parentContext } },
      { otel: { spanName: "child-span" } },
      () => {},
    );

    parentSpan.end();

    const spans = await collectSpans(env.spanExporter);
    expect(spans).toHaveLength(2);

    const childSpan = spans.find((s) => s.name === "child-span");

    // Verify the child span has the correct parent by checking trace ID and parent span ID
    expect(childSpan).toBeDefined();
    expect(childSpan?.spanContext().traceId).toBe(parentTraceId);
    expect(childSpan?.parentSpanContext?.spanId).toBe(parentSpanId);
  });

  it("records duration metrics for both success and error cases", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      tracer: env.tracer,
      meter: env.meter,
    });

    // Success case
    await middleware({ additional: "value", otel: {} }, { otel: {} }, () => {});

    // Error case
    await expect(
      middleware({ additional: "value", otel: {} }, { otel: {} }, () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow();

    const collectedMetrics = await collectMetrics(env.metricReader, env.metricExporter);
    const durationMetric = findMetric(collectedMetrics, "warp.run.duration");

    // Histogram aggregates values, so we check the count which should be 2
    expect(durationMetric.dataPoints[0].value.count).toBe(2);
    expect(durationMetric.dataPoints[0].value.sum).toBeGreaterThanOrEqual(0);
  });

  it("disables error recording by default when recordErrors config is false", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      recordErrors: false,
      tracer: env.tracer,
      meter: env.meter,
    });

    await expect(
      middleware({ additional: "value", otel: {} }, { otel: {} }, () => {
        throw new Error("test error");
      }),
    ).rejects.toThrow("test error");

    const spans = await collectSpans(env.spanExporter);
    expect(spans[0].events).toHaveLength(0);
  });

  it("allows overriding recordErrors config via run options", async () => {
    const env = setupOtelTestEnvironment();
    const middleware = otel<Ctx>({
      instrumentationName: "my-app",
      recordErrors: false,
      tracer: env.tracer,
      meter: env.meter,
    });

    await expect(
      middleware({ additional: "value", otel: {} }, { otel: { recordErrors: true } }, () => {
        throw new Error("test error");
      }),
    ).rejects.toThrow("test error");

    const spans = await collectSpans(env.spanExporter);
    expect(spans[0].events).toHaveLength(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
  });
});
