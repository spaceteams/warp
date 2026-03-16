export type Lazy<T> = () => T;

export const Lazy = {
  cached<T>(factory: () => T): Lazy<T> {
    let cached: T | undefined;
    return () => {
      if (cached === undefined) {
        cached = factory();
      }
      return cached;
    };
  },
  and<S, T>(l: Lazy<S>, r: Lazy<T>): Lazy<S & T> {
    return () => ({
      ...l(),
      ...r(),
    });
  },
  map<S, T>(l: Lazy<S>, fn: (v: S) => T): Lazy<T> {
    return () => fn(l());
  },
};
