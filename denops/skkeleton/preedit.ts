// 現在の文字列の状態を覚えておいて削除命令を発行することで擬似的にVimでIMEのPreEditを実現する
export class PreEdit {
  #current = "";
  #kakutei = "";

  doKakutei(str: string) {
    this.#kakutei += str;
  }

  output(next: string): string {
    const ret = "\b".repeat(this.#current.length) + this.#kakutei + next;
    this.#current = next;
    this.#kakutei = "";
    return ret;
  }
}
