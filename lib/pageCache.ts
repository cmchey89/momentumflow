// Lightweight in-memory cache for client-fetched data, keyed by request URL.
// Renders cached data instantly on repeat visits (stale-while-revalidate) while
// a fresh fetch quietly runs in the background. Dedupes concurrent requests for
// the same key so two components fetching the same URL share one network call.
// Lives only in the browser tab's memory — cleared on full page reload.

const cache = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();
const subscribers = new Map<string, Set<() => void>>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
  subscribers.get(key)?.forEach(cb => cb());
}

// Notifies `callback` whenever this key's cached value changes from *anywhere*
// (another component fetching/mutating the same URL). The callback should just
// re-read getCached(key) and update local state -- never call fetchCached from
// inside it, or a fetch -> setCached -> notify -> fetch loop follows.
export function subscribeCached(key: string, callback: () => void): () => void {
  let set = subscribers.get(key);
  if (!set) { set = new Set(); subscribers.set(key, set); }
  set.add(callback);
  return () => {
    set!.delete(callback);
    if (set!.size === 0) subscribers.delete(key);
  };
}

// Fetches `url` as JSON, deduping concurrent calls for the same url and caching the result.
export function fetchCached<T>(url: string): Promise<T> {
  const pending = inFlight.get(url) as Promise<T> | undefined;
  if (pending) return pending;
  const promise = fetch(url).then(r => r.json()).then((data: T) => {
    setCached(url, data);
    return data;
  });
  inFlight.set(url, promise);
  promise.finally(() => inFlight.delete(url));
  return promise;
}
