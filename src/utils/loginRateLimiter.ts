interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const store = new Map<string, RateLimitEntry>();

export function isRateLimited(ip: string): boolean {
  const entry = store.get(ip);
  if (!entry) return false;
  if (new Date() >= entry.resetAt) {
    store.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(ip: string): void {
  const now = new Date();
  const entry = store.get(ip);
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: new Date(now.getTime() + WINDOW_MS) });
  } else {
    entry.count += 1;
  }
}

export function resetAttempts(ip: string): void {
  store.delete(ip);
}
