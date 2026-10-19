import { describe, expect, it } from 'vitest';
import { MAX_LENGTH, MIN_LENGTH, WORDS, WORDS_BY_LENGTH } from '../src/data/words';
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

  it('読みに重複がない', () => {
    expect(new Set(WORDS.map((w) => w.reading)).size).toBe(WORDS.length);
  });
});
