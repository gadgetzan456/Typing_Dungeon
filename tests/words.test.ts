import { describe, expect, it } from 'vitest';
import { KIND_LABEL, MAX_LENGTH, MIN_LENGTH, THEME_LABEL, WORDS, WORDS_BY_LENGTH, WORD_KINDS } from '../src/data/words';
import { RomajiInput } from '../src/romaji/engine';

describe('単語データ', () => {
  it('すべて3〜12文字', () => {
    for (const w of WORDS) {
      expect(w.length, w.display).toBeGreaterThanOrEqual(MIN_LENGTH);
      expect(w.length, w.display).toBeLessThanOrEqual(MAX_LENGTH);
    }
  });

  it('すべての文字数に単語がある', () => {
    for (let n = MIN_LENGTH; n <= MAX_LENGTH; n++) {
      expect(WORDS_BY_LENGTH.get(n)?.length ?? 0, `${n}文字`).toBeGreaterThan(0);
    }
  });

  it('すべての読みがガイド通りに打ち切れる', () => {
    for (const w of WORDS) {
      const input = new RomajiInput(w.reading);
      for (const k of input.remaining) expect(input.input(k).accepted, w.reading).toBe(true);
      expect(input.isComplete, w.reading).toBe(true);
    }
  });

  it('すべての単語に種類とテーマがあり、各種類に単語がある', () => {
    for (const w of WORDS) {
      expect(KIND_LABEL[w.kind], w.display).toBeDefined();
      expect(THEME_LABEL[w.theme], w.display).toBeDefined();
    }
    for (const k of WORD_KINDS) expect(WORDS.some((w) => w.kind === k), k).toBe(true);
  });

  it('カタカナ語の表示はカタカナだけ', () => {
    for (const w of WORDS.filter((w) => w.kind === 'katakana')) expect(w.display).toMatch(/^[ァ-ヶー]+$/);
  });

  it('四字熟語は漢字4文字', () => {
    for (const w of WORDS.filter((w) => w.kind === 'idiom')) expect(w.display).toMatch(/^\p{Script=Han}{4}$/u);
  });

  it('読みに重複がない', () => {
    expect(new Set(WORDS.map((w) => w.reading)).size).toBe(WORDS.length);
  });
});
