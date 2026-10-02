import "server-only";

/** Limitador en memoria (un único proceso): N intentos por clave en una ventana de tiempo. */
const buckets = new Map<string, number[]>();

export function tooMany(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, hits);
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return hits.length >= max;
}

export function hit(key: string) {
  buckets.set(key, [...(buckets.get(key) ?? []), Date.now()]);
}

export function clear(key: string) {
  buckets.delete(key);
}
