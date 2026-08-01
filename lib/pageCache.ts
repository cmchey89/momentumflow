// Lightweight in-memory cache for client-fetched data, keyed by request URL.
// Renders cached data instantly on repeat visits (stale-while-revalidate) while
// a fresh fetch quietly runs in the background. Dedupes concurrent requests for
// the same key so two components fetching the same URL share one network call.
// Lives only in the browser tab's memory — cleared on full page reload.

const cache = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}

// Fetches `url` as JSON, deduping concurrent calls for the same url and caching the result.
export function fetchCached<T>(url: string): Promise<T> {
  const pending = inFlight.get(url) as Promise<T> | undefined;
  if (pending) return pending;
  const promise = fetch(url).then(r => r.json()).then((data: T) => {
    cache.set(url, data);
    return data;
  });
  inFlight.set(url, promise);
  promise.finally(() => inFlight.delete(url));
  return promise;
}
