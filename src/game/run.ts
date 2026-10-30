import { WORDS, WORDS_BY_LENGTH, WORD_KINDS, type Word, type WordKind } from '../data/words';
import { BALANCE } from './balance';
import { createEnemy, normalEnemyCount, type Enemy } from './enemies';
import {
  KIND_SKILL_GROUPS,
  SKILLS,
  type PlayerStats,
  type SkillDef,
  type SkillHooks,
  type SkillInstance,
  type WordWeights,
} from './skills';

export interface PlayerState {
  hp: number;
  maxHp: number;
}

export interface RunStats {
  kana: number;
  time: number;
  keys: number;
  misses: number;
  maxDamage: number;
  battlesWon: number;
}

export type AdvanceResult = 'next' | 'roundClear' | 'cleared';

const RECENT_LIMIT = 20;

/** 1回の挑戦（3ラウンド × 5戦）の進行状態 */
export class Run {
  round = 1;
  battle = 1;
  player: PlayerState = { hp: BALANCE.player.maxHp, maxHp: BALANCE.player.maxHp };
  skills: SkillInstance[] = [];
  stats: RunStats = { kana: 0, time: 0, keys: 0, misses: 0, maxDamage: 0, battlesWon: 0 };
  /** 直近のラウンド切り替えで回復した量 */
  lastHeal = 0;
  private recent: string[] = [];
  /** このラウンドの通常戦で出す敵の順番（各種1回ずつ） */
  private enemyOrder: number[] = [];
  private enemyOrderRound = 0;

  constructor(readonly rng: () => number = Math.random) {}

  get isBossBattle(): boolean {
    return this.battle === BALANCE.run.battlesPerRound;
  }

  get isFinalBattle(): boolean {
    return this.round === BALANCE.run.rounds && this.isBossBattle;
  }

  createEnemy(): Enemy {
    if (this.enemyOrderRound !== this.round) {
      this.enemyOrder = this.shuffle([...Array(normalEnemyCount(this.round)).keys()]);
      this.enemyOrderRound = this.round;
    }
    const index = this.enemyOrder[(this.battle - 1) % this.enemyOrder.length];
    return createEnemy(this.round, this.battle, this.isBossBattle, index);
  }

  /** 各スキルの指定フックを呼ぶ */
  eachHook<K extends keyof SkillHooks>(
    name: K,
    call: (hook: NonNullable<SkillHooks[K]>, s: SkillInstance) => void,
  ): void {
    for (const s of this.skills) {
      const hook = s.def.hooks[name];
      if (hook) call(hook as NonNullable<SkillHooks[K]>, s);
    }
  }

  playerStats(): PlayerStats {
    const st: PlayerStats = { attackMult: 1, defenseAdd: 0, defenseCapAdd: 0, penaltyMult: 1 };
    this.eachHook('stats', (h, s) => h(s, st));
    st.penaltyMult = Math.max(0, st.penaltyMult);
    return st;
  }

  addSkill(def: SkillDef): void {
    let inst = this.skills.find((s) => s.def.id === def.id);
    if (inst) inst.stacks++;
    else {
      inst = { def, stacks: 1, run: {}, battle: {} };
      this.skills.push(inst);
    }
    def.hooks.onAcquire?.(inst, this.player);
  }

  stacksOf(id: string): number {
    return this.skills.find((s) => s.def.id === id)?.stacks ?? 0;
  }

  skillOffers(count = 3): SkillDef[] {
    const available = (d: SkillDef) => this.stacksOf(d.id) < d.maxStacks;
    const pool = SKILLS.filter(available);
    // 種類ごとのスキルは型ごとに1つだけ。持っている種類があれば半分の確率でそれを出してレベルを上げやすくする
    for (const group of KIND_SKILL_GROUPS) {
      const candidates = group.filter(available);
      if (candidates.length === 0) continue;
      const owned = candidates.filter((d) => this.stacksOf(d.id) > 0);
      const from = owned.length > 0 && this.rng() < 0.5 ? owned : candidates;
      pool.push(from[Math.floor(this.rng() * from.length)]);
    }
    return this.shuffle(pool).slice(0, count);
  }

  private shuffle<T>(list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  wordWeights(): WordWeights {
    const weights: WordWeights = {
      length: { ...BALANCE.wordWeights },
      kind: Object.fromEntries(WORD_KINDS.map((k) => [k, 1])) as Record<WordKind, number>,
    };
    this.eachHook('wordWeights', (h, s) => h(s, weights));
    return weights;
  }

  pickAttackWord(): Word {
    const w = this.wordWeights();
    // 文字数の重みはその文字数の単語に等分し、種類の倍率を掛ける
    const weightOf = (word: Word) =>
      ((w.length[word.length] ?? 0) / WORDS_BY_LENGTH.get(word.length)!.length) * w.kind[word.kind];
    const fresh = WORDS.filter((word) => !this.recent.includes(word.reading) && weightOf(word) > 0);
    const pool = fresh.length > 0 ? fresh : WORDS;
    const total = pool.reduce((sum, word) => sum + weightOf(word), 0);
    let r = this.rng() * total;
    let picked = pool[pool.length - 1];
    for (const word of pool) {
      r -= weightOf(word);
      if (r < 0) {
        picked = word;
        break;
      }
    }
    this.remember(picked);
    return picked;
  }

  pickDefenseWord(): Word {
    const { minLength, maxLength } = BALANCE.defense;
    return this.pickFrom(WORDS.filter((w) => w.length >= minLength && w.length <= maxLength));
  }

  private pickFrom(list: Word[]): Word {
    const fresh = list.filter((w) => !this.recent.includes(w.reading));
    const pool = fresh.length > 0 ? fresh : list;
    const word = pool[Math.floor(this.rng() * pool.length)];
    this.remember(word);
    return word;
  }

  private remember(word: Word): void {
    this.recent.push(word.reading);
    if (this.recent.length > RECENT_LIMIT) this.recent.shift();
  }

  /** 勝利してスキルを選んだ後に、次の戦闘へ進める */
  advance(): AdvanceResult {
    if (this.isFinalBattle) return 'cleared';
    if (this.isBossBattle) {
      this.round++;
      this.battle = 1;
      const missing = this.player.maxHp - this.player.hp;
      this.lastHeal = Math.round(missing * BALANCE.run.roundHealRatio);
      this.player.hp += this.lastHeal;
      return 'roundClear';
    }
    this.battle++;
    return 'next';
  }
}
