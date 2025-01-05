const segmenter = new Intl.Segmenter("ja");

// 現在の文字列の状態を覚えておいて削除命令を発行することで擬似的にVimでIMEのPreEditを実現する
export class PreEdit {
  #current = "";
  #kakutei = "";

  doKakutei(str: string) {
    this.#kakutei += str;
  }

  output(next: string): string {
    let ret: string;
    // 補完ウィンドウのちらつき防止のため必要のないバックスペースを送らない
    if (!this.#kakutei && next.startsWith(this.#current)) {
      ret = next.slice(this.#current.length);
    } else {
      ret = "\b".repeat([...segmenter.segment(this.#current)].length) +
        this.#kakutei + next;
    }
    this.#current = next;
    this.#kakutei = "";
    return ret;
  }
}
