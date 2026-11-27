type CacheEntry<T> = {
  value: T;
  ts: number;
};

const store = new Map<string, CacheEntry<unknown>>();
let currentScope = "anon";

function scopedKey(key: string): string {
  return `${currentScope}::${key}`;
}

export function setCacheScope(scope: string | null | undefined): void {
  const next = scope ?? "anon";
  if (next !== currentScope) {
    store.clear();
    currentScope = next;
  }
}

export function getCacheScope(): string {
  return currentScope;
}

export function cacheClear(): void {
  store.clear();
}

export function cacheGet<T>(key: string, maxAgeMs: number): T | undefined {
  const entry = store.get(scopedKey(key));
  if (!entry) return undefined;
  if (Date.now() - entry.ts > maxAgeMs) return undefined;
  return entry.value as T;
}

export function cacheGetStale<T>(key: string): T | undefined {
  const entry = store.get(scopedKey(key));
  return entry?.value as T | undefined;
}

export function cacheSet<T>(key: string, value: T, scope?: string): void {
  if (scope !== undefined && scope !== currentScope) return;
  store.set(scopedKey(key), { value, ts: Date.now() });
}

export function cacheDelete(key: string): void {
  store.delete(scopedKey(key));
}

export function cacheDeletePrefix(prefix: string): void {
  const full = scopedKey(prefix);
  for (const k of store.keys()) {
    if (k.startsWith(full)) store.delete(k);
  }
}
