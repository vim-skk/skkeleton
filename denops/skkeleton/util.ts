// NOTE: import * as encoding does not work!
import encoding from "npm:encoding-japanese@2.2.0";

import { Denops } from "jsr:@denops/std@^7.6.0";
import * as fn from "jsr:@denops/std@^7.6.0/function";
import * as op from "jsr:@denops/std@^7.6.0/option";
import { basename } from "jsr:@std/path@~1.0.3/basename";
import { parse } from "jsr:@std/path@~1.0.3/parse";

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
    this.initialized = false;
  }
}

let homePath: string | undefined = undefined;
export async function homeExpand(
  path: string,
  denops: Denops,
): Promise<string> {
  if (homePath === undefined) {
    homePath = await fn.expand(denops, "~") as string;
  }
  if (path[0] === "~") {
    return homePath + path.slice(1);
  } else {
    return path;
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

export async function globpath(
  denops: Denops,
  search: string,
): Promise<Record<string, string>> {
  const runtimepath = await op.runtimepath.getGlobal(denops);

  const paths: Record<string, string> = {};
  const glob = await fn.globpath(
    denops,
    runtimepath,
    search + "/*.ts",
    1,
    1,
  );

  for (const path of glob) {
    // Skip already added name.
    const parsed = parse(path);
    const key = `${basename(parsed.dir)}/${parsed.name}`;
    if (key in paths) {
      continue;
    }

    paths[key] = path;
  }

  return paths;
}
