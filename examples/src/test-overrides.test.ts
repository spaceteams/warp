import { buildRuntime } from "@spaceteams/warp";
import { describe, expect, it } from "vitest";

// Test overrides example
//
// This demonstrates how to replace a component dependency with a concrete
// instance in tests. You already know how to compose factories; here we show
// `valueOfComponent` (a helper from the runtime) which allows injecting a
// pre-constructed value instead of wrapping a factory.
//
// This is useful when you want to mock or stub a dependency without providing
// the full factory implementation.
const mailer = () => ({
  send: (to: string, subject: string) => `sent:${to}:${subject}`,
});

type Mailer = ReturnType<typeof mailer>;

type Deps = { mailer: Mailer };

const inviteUser = (ctx: Deps) => (email: string) => {
  return ctx.mailer.send(email, "Welcome");
};

const fakeMailer: Mailer = {
  send: (to, subject) => `fake:${to}:${subject}`,
};

describe("test overrides", () => {
  const { resolve, component } = buildRuntime().provide({});

  it("allows for overriding a component dependency", async () => {
    const invite = await resolve(
      component(inviteUser, {
        // Provide a concrete value instead of a factory – useful for fakes.
        mailer: fakeMailer,
      }),
    );
    const result = invite("user@example.com");
    expect(result).toBe("fake:user@example.com:Welcome");
  });
});
