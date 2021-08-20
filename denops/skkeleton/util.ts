export class Cell<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
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
