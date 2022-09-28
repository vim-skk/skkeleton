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
    this.initialized = true;
  }
}

export class LazyCell<T> {
  initialized = false;
  initializer: () => T;
  lazyInitializer?: () => Promise<T>;
  value: T = null as unknown as T;

  constructor(initializer: () => T) {
    this.initializer = initializer;
  }

  init() {
    this.value = this.initializer();
    this.initialized = true;
    return this.value;
  }

  async get(): Promise<T> {
    if (!this.initialized) {
      this.value = this.lazyInitializer
        ? await this.lazyInitializer()
        : this.initializer();
      this.initialized = true;
    }
    return this.value;
  }

  set(value: T) {
    this.value = value;
    this.initialized = true;
  }

  setInitializer(initializer: () => Promise<T>) {
    this.lazyInitializer = initializer;
  }
}
