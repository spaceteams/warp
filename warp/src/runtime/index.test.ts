import { describe, expect, it, vi } from "vitest";
import type { Middleware } from "../middleware";
import { RuntimeBuilder } from "./runtime-builder";

function levelMiddleware(): Middleware<{ level: number }> {
  return (ctx, _options, next) => next({ level: ctx.level + 1 });
}

describe("runtime-builder", () => {
  it("registers context", async () => {
    const onCreate = vi.fn();
    const { component, resolve } = new RuntimeBuilder().provide({ context: "1" });
    await resolve(
      component((a) => {
        onCreate(a);
        return a;
      }),
    );
    expect(onCreate).toHaveBeenCalledWith({
      context: "1",
      run: expect.anything(),
    });
  });

  it("registers middleware", async () => {
    const { component, resolve } = new RuntimeBuilder()
      .use(levelMiddleware())
      .provide({ level: 0 });
    const request = await resolve(component((a) => a));
    expect(request.level).toEqual(0);

    request.run({}, async ({ level }) => {
      expect(level).toEqual(1);
    });
  });
});
