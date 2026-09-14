const segmenter = new Intl.Segmenter("ja");

// how many backspaces are needed to delete the string
export function graphemeLength(str: string): number {
  return [...segmenter.segment(str)].length;
}

// 現在の文字列の状態を覚えておいて削除命令を発行することで擬似的にVimでIMEのPreEditを実現する
export class PreEdit {
  #current = "";
  #kakutei = "";

  // whether the key handling has written something which Vim has not received
  // yet: the output is only fed back once the handling has returned
  get dirty(): boolean {
    return this.#kakutei !== "";
  }

  doKakutei(str: string) {
    this.#kakutei += str;
  }

  output(next: string): string {
    let ret: string;
    // 補完ウィンドウのちらつき防止のため必要のないバックスペースを送らない
    if (!this.#kakutei && next.startsWith(this.#current)) {
      ret = next.slice(this.#current.length);
    } else {
      ret = "\b".repeat(graphemeLength(this.#current)) +
        this.#kakutei + next;
    }
    this.#current = next;
    this.#kakutei = "";
    return ret;
  }
}
