export type Lazy<T, Args extends unknown[] = []> = (...args: Args) => T;

export const Lazy = {
  cached<T, Args extends unknown[] = []>(factory: Lazy<T, Args>): Lazy<T, Args> {
    let cached: T | undefined;
    return (...args) => {
      if (cached === undefined) {
        cached = factory(...args);
      }
      return cached;
    };
  },
  and<S, T, Args extends unknown[] = []>(l: Lazy<S, Args>, r: Lazy<T, Args>): Lazy<S & T, Args> {
    return (...args) => ({
      ...l(...args),
      ...r(...args),
    });
  },
  map<S, T, Args extends unknown[] = []>(l: Lazy<S, Args>, fn: (v: S) => T): Lazy<T, Args> {
    return (...args) => fn(l(...args));
  },
};
