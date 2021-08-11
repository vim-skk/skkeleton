export class PreEdit {
  current = "";
  kakutei = "";

  output(next: string): string {
    const ret = "\x08".repeat(this.current.length) + this.kakutei + next;
    this.current = next;
    this.kakutei = "";
    return ret;
  }
}
