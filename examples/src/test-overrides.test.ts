import { buildRuntime, client, usecase } from "@spaceteams/warp";
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
const mailer = client({ name: "mailer" }, () => ({
  send: (to: string, subject: string) => `sent:${to}:${subject}`,
}));

type Mailer = ReturnType<typeof mailer>;

const inviteUser = usecase<{ mailer: Mailer }, [string], string>(
  { name: "invite-user" },
  (ctx) => async (email) => {
    return ctx.mailer.send(email, "Welcome");
  },
);

const fakeMailer: Mailer = {
  send: (to, subject) => `fake:${to}:${subject}`,
};

describe("test overrides", () => {
  const { explain, resolve, component } = buildRuntime().provide({});

  const graph = component(inviteUser, {
    mailer: component(mailer),
  });
  const testGraph = component(inviteUser, {
    // Provide a concrete value instead of a factory – useful for fakes.
    mailer: fakeMailer,
  });

  it("allows for overriding a component dependency", async () => {
    const invite = await resolve(testGraph);
    const result = await invite("user@example.com");
    expect(result).toBe("fake:user@example.com:Welcome");
  });

  it("can be explained", () => {
    expect(explain(testGraph, "ascii", true)).toMatchInlineSnapshot(`
        "└── invite-user [usecase]
            └── mailer"
      `);
    expect(explain(graph, "ascii", true)).toMatchInlineSnapshot(`
        "└── invite-user [usecase]
            └── mailer -> mailer [client]"
      `);
  });
});
