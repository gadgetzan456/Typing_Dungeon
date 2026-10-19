import { el, flash } from './dom';

const ROWS = ['1234567890-', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm,.'];
const HOME = new Set(['f', 'j']);

/** 画面下のキーボード。次に打つキーの強調と、押したキーの反応を表示する */
export class KeyboardView {
  readonly el = el('div', 'keyboard');
  private keys = new Map<string, HTMLElement>();
  private highlighted: HTMLElement | null = null;

  constructor() {
    ROWS.forEach((row, i) => {
      const r = el('div', `kb-row kb-row-${i}`);
      for (const k of row) {
        const key = el('div', HOME.has(k) ? 'key home' : 'key', k.toUpperCase());
        this.keys.set(k, key);
        r.append(key);
      }
      this.el.append(r);
    });
  }

  highlight(key: string | null): void {
    const next = key ? this.keys.get(key) ?? null : null;
    if (next === this.highlighted) return;
    this.highlighted?.classList.remove('next');
    next?.classList.add('next');
    this.highlighted = next;
  }

  press(key: string, ok: boolean): void {
    const k = this.keys.get(key.toLowerCase());
    if (k) flash(k, ok ? 'pressed' : 'missed');
  }
}
