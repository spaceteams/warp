import { buildRuntime, type Middleware, type Run } from "@spaceteams/warp";
import { describe, expect, it } from "vitest";

// Tracing / metrics example
//
// This demonstrates runtime middleware and scoped execution with `Run`.
// Middleware can observe or mutate the context for the duration of a run.
// The example shows:
// - A `tracing` middleware that records span start/end to a sink.
// - How to register middleware with `buildRuntime().use(...)` so that calls to
//   `ctx.run(hints, callback)` create nested scopes where middleware receives
//   the provided hints (e.g. spanName).
// - That nested runs can be used to produce isolated spans / metrics for parts
//   of a larger operation.
type TraceOptions = { spanName: string };
type Ctx = { sink: string[] };

const tracing = (): Middleware<Ctx, TraceOptions, { span: string }> => {
  return async (ctx, hints, next) => {
    ctx.sink.push(`start:${hints.spanName}`);
    try {
      return await next({ ...ctx, span: "some-span" });
    } finally {
      ctx.sink.push(`end:${hints.spanName}`);
    }
  };
};

const repo = () => (id: string) => `repo:${id}`;

type Deps = { repo: ReturnType<typeof repo> };

const useCase = (ctx: Run<Ctx & Deps, { span: string }, TraceOptions>) => async () => {
  const result = [ctx.repo("outer")];
  // `ctx.run(...)` creates a nested scope in which middleware receives the
  // provided hints (`{ spanName: "inner-work" }`). The tracing middleware
  // records start/end for that nested scope only.
  await ctx.run({ spanName: "inner-work" }, async (inner) => {
    result.push(inner.repo(inner.span));
  });
  return result;
};

describe("tracing", () => {
  // Register the middleware on the runtime. Provide the sink via `.with({...})`.
  const sink: string[] = [];
  const { resolve, component } = buildRuntime().use(tracing()).provide({ sink });

  it("applies isolation levels per scope as requested", async () => {
    const instance = await resolve(
      component(useCase, {
        repo: component(repo),
      }),
    );
    expect(await instance()).toEqual(["repo:outer", "repo:some-span"]);
    // The tracing middleware should have recorded start/end for the inner span.
    expect(sink).toEqual(["start:inner-work", "end:inner-work"]);
  });
});
