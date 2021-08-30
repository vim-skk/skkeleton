export class Cell<T> {
  initialized = false;
  initializer: () => T;
  value: T = null as unknown as T;

  constructor(initializer: () => T) {
    this.initializer = initializer;
  }

  init() {
    this.value = this.initializer();
    this.initialized = true;
    return this.value;
  }

  get(): T {
    if (!this.initialized) {
      this.value = this.initializer();
      this.initialized = true;
    }
    return this.value;
  }

  set(value: T) {
    this.value = value;
  }
}

/**
 * Undo point string of Vim
 */
export const undoPoint = "\x07u";
