import { WORDS, WORDS_BY_LENGTH, type Word } from '../data/words';
import { BALANCE } from './balance';
import { createEnemy, type Enemy } from './enemies';
import { SKILLS, type PlayerStats, type SkillDef, type SkillHooks, type SkillInstance } from './skills';

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

  constructor(readonly rng: () => number = Math.random) {}

  get isBossBattle(): boolean {
    return this.battle === BALANCE.run.battlesPerRound;
  }

  get isFinalBattle(): boolean {
    return this.round === BALANCE.run.rounds && this.isBossBattle;
  }

  createEnemy(): Enemy {
    return createEnemy(this.round, this.battle, this.isBossBattle, this.rng);
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
    const pool = SKILLS.filter((d) => this.stacksOf(d.id) < d.maxStacks);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  pickAttackWord(): Word {
    const weights = { ...BALANCE.wordWeights };
    this.eachHook('wordWeights', (h, s) => h(s, weights));
    const lengths = Object.keys(weights)
      .map(Number)
      .filter((l) => weights[l] > 0 && WORDS_BY_LENGTH.has(l));
    const total = lengths.reduce((sum, l) => sum + weights[l], 0);
    let r = this.rng() * total;
    let length = lengths[lengths.length - 1];
    for (const l of lengths) {
      r -= weights[l];
      if (r < 0) {
        length = l;
        break;
      }
    }
    return this.pickFrom(WORDS_BY_LENGTH.get(length)!);
  }

  pickDefenseWord(): Word {
    const { minLength, maxLength } = BALANCE.defense;
    return this.pickFrom(WORDS.filter((w) => w.length >= minLength && w.length <= maxLength));
  }

  private pickFrom(list: Word[]): Word {
    const fresh = list.filter((w) => !this.recent.includes(w.reading));
    const pool = fresh.length > 0 ? fresh : list;
    const word = pool[Math.floor(this.rng() * pool.length)];
    this.recent.push(word.reading);
    if (this.recent.length > RECENT_LIMIT) this.recent.shift();
    return word;
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
