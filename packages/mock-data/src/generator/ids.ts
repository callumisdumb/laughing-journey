/** Sequential, prefixed ids. Deterministic because the generator runs in a fixed order. */
export class IdFactory {
  private counters = new Map<string, number>();

  next(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}_${String(n).padStart(4, '0')}`;
  }

  /** Reserve a fixed id used by hand-authored scenarios. */
  fixed(prefix: string, slug: string): string {
    return `${prefix}_${slug}`;
  }
}
