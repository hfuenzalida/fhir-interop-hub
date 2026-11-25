/** Tiny in-memory TTL map for hot discovery/metadata responses (GAP 5). */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    if (this.ttlMs <= 0) return undefined;
    const row = this.store.get(key);
    if (!row) return undefined;
    if (Date.now() >= row.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return row.value;
  }

  set(key: string, value: T): void {
    if (this.ttlMs <= 0) return;
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}
