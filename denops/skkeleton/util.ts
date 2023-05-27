import { encoding } from "./deps/encoding_japanese.ts";

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

const encodingNames: Record<string, string> = {
  "EUCJP": "euc-jp",
  "SJIS": "shift-jis",
  "UTF8": "utf-8",
};

export async function readFileWithEncoding(
  path: string,
  encodingName: string | undefined,
): Promise<string> {
  const uint = await Deno.readFile(path);

  // Use the argument if provided, otherwise try to detect the encoding.
  const fileEncoding = encodingName !== undefined && encodingName !== ""
    ? encodingName
    : encodingNames[String(encoding.detect(uint))];

  const decoder = new TextDecoder(fileEncoding);
  return decoder.decode(uint);
}
