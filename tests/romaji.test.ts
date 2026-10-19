import { describe, expect, it } from 'vitest';
import { RomajiInput } from '../src/romaji/engine';

function typeAll(reading: string, keys: string): { ok: boolean; done: boolean; input: RomajiInput } {
  const input = new RomajiInput(reading);
  for (const k of keys) {
    if (!input.input(k).accepted) return { ok: false, done: false, input };
  }
  return { ok: true, done: input.isComplete, input };
}

function accepts(reading: string, keys: string): boolean {
  const r = typeAll(reading, keys);
  return r.ok && r.done;
}

describe('RomajiInput', () => {
  it('基本的なかなを打てる', () => {
    expect(accepts('さくら', 'sakura')).toBe(true);
  });

  it('表記ゆれを受け付ける', () => {
    expect(accepts('しち', 'shichi')).toBe(true);
    expect(accepts('しち', 'siti')).toBe(true);
    expect(accepts('しち', 'cichi')).toBe(true);
    expect(accepts('ふじ', 'huzi')).toBe(true);
    expect(accepts('つくえ', 'tukue')).toBe(true);
    expect(accepts('かく', 'cacu')).toBe(true);
  });

  it('拗音は一括でも分割でも打てる', () => {
    expect(accepts('しゃ', 'sha')).toBe(true);
    expect(accepts('しゃ', 'sya')).toBe(true);
    expect(accepts('しゃ', 'shixya')).toBe(true);
    expect(accepts('しゃ', 'silya')).toBe(true);
    expect(accepts('じゅもん', 'jumonn')).toBe(true);
    expect(accepts('じゅもん', 'zyumonn')).toBe(true);
    expect(accepts('じゅもん', 'jixyumonn')).toBe(true);
  });

  it('ん: 子音の前は n 1回でよい', () => {
    expect(accepts('かんじ', 'kanji')).toBe(true);
    expect(accepts('かんじ', 'kannji')).toBe(true);
    expect(accepts('かんじ', 'kaxnji')).toBe(true);
  });

  it('ん: 母音・な行・や行の前と語末は nn が必要', () => {
    expect(accepts('きんえん', 'kinenn')).toBe(false);
    expect(accepts('きんえん', 'kinnenn')).toBe(true);
    expect(accepts('さんねん', 'sannenn')).toBe(false);
    expect(accepts('さんねん', 'sannnenn')).toBe(true);
    expect(accepts('ほんや', 'honnya')).toBe(true);
    expect(typeAll('みかん', 'mikan').done).toBe(false);
    expect(accepts('みかん', 'mikann')).toBe(true);
  });

  it('っ: 子音を重ねるか xtu / ltu で打てる', () => {
    expect(accepts('きって', 'kitte')).toBe(true);
    expect(accepts('きって', 'kixtute')).toBe(true);
    expect(accepts('きって', 'kiltsute')).toBe(true);
    expect(accepts('まっちゃ', 'maccha')).toBe(true);
    expect(accepts('まっちゃ', 'mattya')).toBe(true);
    expect(accepts('いっしょ', 'issho')).toBe(true);
    expect(accepts('いっしょ', 'issyo')).toBe(true);
  });

  it('カタカナと長音を扱える', () => {
    expect(accepts('キーボード', 'ki-bo-do')).toBe(true);
    expect(accepts('ファイア', 'faia')).toBe(true);
    expect(accepts('ファイア', 'huxaia')).toBe(true);
  });

  it('間違ったキーは受け付けず、状態も変わらない', () => {
    const input = new RomajiInput('ねこ');
    expect(input.input('n').accepted).toBe(true);
    expect(input.input('o').accepted).toBe(false);
    expect(input.typed).toBe('n');
    expect(input.input('e').accepted).toBe(true);
    expect(input.kanaDone).toBe(1);
  });

  it('ガイドは打ち方に追従する', () => {
    const input = new RomajiInput('しゃしん');
    expect(input.remaining).toBe('shashinn');
    input.input('s');
    input.input('y');
    expect(input.typed + input.remaining).toBe('syashinn');
    input.input('a');
    input.input('s');
    input.input('i');
    expect(input.typed + input.remaining).toBe('syasinn');
  });

  it('ん は n 1回で打てる場合はガイドも n にする', () => {
    expect(new RomajiInput('かんじ').remaining).toBe('kanji');
    expect(new RomajiInput('きんえん').remaining).toBe('kinnenn');
  });

  it('nextKey は次に打つべきキーを返す', () => {
    const input = new RomajiInput('きって');
    expect(input.nextKey).toBe('k');
    input.input('k');
    input.input('i');
    expect(input.nextKey).toBe('t');
  });
});
