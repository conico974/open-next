import { debug, error } from "../adapters/logger";

/**
 * A `Promise.withResolvers` implementation that exposes the `resolve` and
 * `reject` functions on a `Promise`.
 * Copied from next https://github.com/vercel/next.js/blob/canary/packages/next/src/lib/detached-promise.ts
 * @see https://tc39.es/proposal-promise-with-resolvers/
 */
export class DetachedPromise<T = any> {
  public readonly resolve: (value: T | PromiseLike<T>) => void;
  public readonly reject: (reason: any) => void;
  public readonly promise: Promise<T>;

  constructor() {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason: any) => void;

    // Create the promise and assign the resolvers to the object.
    this.promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // We know that resolvers is defined because the Promise constructor runs
    // synchronously.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.resolve = resolve!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.reject = reject!;
  }
}

export class DetachedPromiseRunner {
  private promises: DetachedPromise<any>[] = [];

  public withResolvers<T>(): DetachedPromise<T> {
    const detachedPromise = new DetachedPromise<T>();
    this.promises.push(detachedPromise);
    return detachedPromise;
  }

  public add<T>(promise: Promise<T>): void {
    const detachedPromise = new DetachedPromise<T>();
    this.promises.push(detachedPromise);
    promise.then(detachedPromise.resolve, detachedPromise.reject);
  }

  public async await(): Promise<void> {
    debug(`Awaiting ${this.promises.length} detached promises`);
    const results = await Promise.allSettled(
      this.promises.map((p) => p.promise),
    );
    const rejectedPromises = results.filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[];
    rejectedPromises.forEach((r) => {
      error(r.reason);
    });
  }
}

export async function awaitAllDetachedPromise() {
  const promisesToAwait =
    globalThis.__als.getStore()?.pendingPromiseRunner.await() ??
    Promise.resolve();
  if (globalThis.openNextWaitUntil) {
    globalThis.openNextWaitUntil(promisesToAwait);
    return;
  }
  await promisesToAwait;
}

export function provideNextAfterProvider() {
  /** This should be considered unstable until `unstable_after` is stablized. */
  const NEXT_REQUEST_CONTEXT_SYMBOL = Symbol.for("@next/request-context");

  // This is needed by some lib that relies on the vercel request context to properly await stuff.
  // Remove this when vercel builder is updated to provide '@next/request-context'.
  const VERCEL_REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

  const openNextStoreContext = globalThis.__als.getStore();

  const awaiter =
    globalThis.openNextWaitUntil ??
    ((promise: Promise<unknown>) =>
      openNextStoreContext?.pendingPromiseRunner.add(promise));

  const nextAfterContext = {
    get: () => ({
      waitUntil: awaiter,
    }),
  };

  //@ts-expect-error
  globalThis[NEXT_REQUEST_CONTEXT_SYMBOL] = nextAfterContext;
  // We probably want to avoid providing this everytime since some lib may incorrectly think they are running in Vercel
  // It may break stuff, but at the same time it will allow libs like `@vercel/otel` to work as expected
  if (process.env.EMULATE_VERCEL_REQUEST_CONTEXT) {
    //@ts-expect-error
    globalThis[VERCEL_REQUEST_CONTEXT_SYMBOL] = nextAfterContext;
  }
}
