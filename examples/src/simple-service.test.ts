import { buildRuntime } from "@spaceteams/warp";
import { describe, expect, it } from "vitest";

// A very small "repository" component factory that returns a function.
// Given an id string it will return a derived string (used here to keep the example trivial).
const repo = () => (id: string) => `${id}-result`;

// Type alias for the repo component's runtime type, useful for typing dependent services.
type Repo = ReturnType<typeof repo>;

// Describe the dependencies that our service expects.
// In a real app this might include database clients, HTTP clients, etc.
type ServiceDeps = { repo: Repo };

// The service component itself. It is a function that accepts a dependency context
// and returns the actual function (or object) that implements the service.
// Here the service simply delegates to the repo function from its context.
const service = (ctx: ServiceDeps) => (id: string) => {
  return ctx.repo(id);
};

describe("simple service with repo", () => {
  // buildRuntime() creates a test runtime for composing components.
  // .with({}) can be used to pre-register components; we pass an empty object here.
  // The runtime exposes helpers:
  // - component: wrap a factory so it can be declared as a component
  // - resolve: instantiate a component graph into a concrete instance
  const { resolve, component } = buildRuntime().provide({});

  // Declare the service component and provide its repo dependency by
  // wrapping the repo factory as a component as well.
  const serviceComponent = component(service, { repo: component(repo) });

  it("reads argument", async () => {
    // Then resolve the service to get a concrete instance we can call in the test.
    const instance = await resolve(serviceComponent);

    // The service simply forwards the id to the repo, which appends "-result".
    expect(instance("my-user")).toEqual("my-user-result");
  });
});
