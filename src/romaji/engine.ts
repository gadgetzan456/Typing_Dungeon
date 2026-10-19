import { COMBO, SINGLE } from './table';

/** かなの位置ごとの打ち方の候補。consume は何文字のかなを消費するか。 */
interface Chunk {
  consume: number;
  romaji: string;
}

export interface KeyResult {
  accepted: boolean;
  completed: boolean;
}

// 「っ」で重ねられる子音（n・x・l は重ねない）
const DOUBLABLE = /^[bcdfghjkmpqrstvwyz]/;
// 「ん」を n 1回で打てない、次のかなの先頭文字
const BLOCKS_SINGLE_N = /^[aiueony]/;

export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function buildChunks(kana: string): Chunk[][] {
  const chunks: Chunk[][] = new Array(kana.length);
  // 「っ」「ん」は次の位置の候補に依存するので後ろから組み立てる
  for (let i = kana.length - 1; i >= 0; i--) {
    const c = kana[i];
    const next = kana[i + 1];
    const list: Chunk[] = [];
    const combo = next ? COMBO[c + next] : undefined;
    if (combo) list.push(...combo.map((romaji) => ({ consume: 2, romaji })));

    if (c === 'っ') {
      if (i + 1 < kana.length) {
        for (const o of chunks[i + 1]) {
          if (DOUBLABLE.test(o.romaji)) list.push({ consume: 1 + o.consume, romaji: o.romaji[0] + o.romaji });
        }
      }
      list.push(...SINGLE['っ'].map((romaji) => ({ consume: 1, romaji })));
    } else if (c === 'ん') {
      if (i + 1 < kana.length && chunks[i + 1].every((o) => !BLOCKS_SINGLE_N.test(o.romaji))) {
        list.push({ consume: 1, romaji: 'n' });
      }
      list.push({ consume: 1, romaji: 'nn' }, { consume: 1, romaji: 'xn' });
    } else {
      const singles = SINGLE[c];
      if (!singles) throw new Error(`ローマ字に変換できない文字です: "${c}" (${kana})`);
      list.push(...singles.map((romaji) => ({ consume: 1, romaji })));
    }

    const seen = new Set<string>();
    chunks[i] = list.filter((o) => !seen.has(o.romaji) && seen.add(o.romaji));
  }
  return chunks;
}

/**
 * 1単語ぶんのローマ字入力の状態を管理する。
 * 複数の打ち方を受け付け、ガイド表示はプレイヤーの打ち方に追従する。
 */
export class RomajiInput {
  readonly kana: string;
  private readonly chunks: Chunk[][];
  private pos = 0;
  private buffer = '';
  private committed = '';

  constructor(reading: string) {
    this.kana = toHiragana(reading);
    this.chunks = buildChunks(this.kana);
  }

  get isComplete(): boolean {
    return this.pos >= this.kana.length;
  }

  /** 確定済みのかな文字数 */
  get kanaDone(): number {
    return this.pos;
  }

  get kanaTotal(): number {
    return this.kana.length;
  }

  /** 入力済みのローマ字 */
  get typed(): string {
    return this.committed + this.buffer;
  }

  /** 残りのローマ字ガイド */
  get remaining(): string {
    if (this.isComplete) return '';
    const cur = this.chunks[this.pos].find((o) => o.romaji.startsWith(this.buffer))!;
    let s = cur.romaji.slice(this.buffer.length);
    for (let j = this.pos + cur.consume; j < this.kana.length; ) {
      const o = this.chunks[j][0];
      s += o.romaji;
      j += o.consume;
    }
    return s;
  }

  get nextKey(): string | null {
    return this.remaining[0] ?? null;
  }

  input(key: string): KeyResult {
    if (this.isComplete) return { accepted: false, completed: true };
    const ch = key.toLowerCase();
    const options = this.chunks[this.pos];
    const nb = this.buffer + ch;
    const candidates = options.filter((o) => o.romaji.startsWith(nb));

    if (candidates.length > 0) {
      this.buffer = nb;
      const exact = candidates.find((o) => o.romaji === nb);
      // 「n」のように、さらに長い候補が残っている間は確定を保留する
      if (exact && candidates.every((o) => o.romaji.length === nb.length)) this.commit(exact);
      return { accepted: true, completed: this.isComplete };
    }

    // 保留中の候補（例: ん の n）で確定できるなら確定して、次の位置で打ち直す
    const pending = this.buffer && options.find((o) => o.romaji === this.buffer);
    if (pending) {
      this.commit(pending);
      return this.input(ch);
    }
    return { accepted: false, completed: false };
  }

  private commit(chunk: Chunk): void {
    this.committed += chunk.romaji;
    this.pos += chunk.consume;
    this.buffer = '';
  }
}
