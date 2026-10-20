// Simulated network latency: long enough to stay asynchronous like a real API, short enough that no page flashes an empty state before its data lands.
export function delay<T>(value: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
