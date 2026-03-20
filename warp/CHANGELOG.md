# @spaceteams/warp

## 0.3.1

### Patch Changes

- c3887c3: introduce open-telemetry for tracing and monitoring

  - otel middleware
  - meta information through middleware stack

- 104e290: added warp-als middleware to expose a context through async local storage to methods outside the component graph
- a144cd2: add singleton components

## 0.3.0

### Minor Changes

- 1f60222: - lazy config loading
  - semantic helpers and meta annotation

## 0.2.0

### Minor Changes

- 43bd2ef: reordered the generics so we can cleanly support scope context induced by middleware

## 0.1.1

### Patch Changes

- 74ebaa4: add explain tooling to render a dependency graph to ascii or mermaid

## 0.1.0

### Minor Changes

- 890432f: initial public release
