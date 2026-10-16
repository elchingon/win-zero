// A Storage for tests: localStorage's interface over a Map, optionally refusing every call (a
// private window or blocked site data).
export class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  constructor(private readonly blocked = false) {}
  private check() {
    if (this.blocked) throw new DOMException('The operation is insecure.', 'SecurityError');
  }
  get length() {
    return this.items.size;
  }
  clear() {
    this.check();
    this.items.clear();
  }
  getItem(key: string) {
    this.check();
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.check();
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.check();
    this.items.set(key, value);
  }
}
