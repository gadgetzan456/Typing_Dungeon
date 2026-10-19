import { KIND_LABEL, WORD_KINDS, type WordKind } from '../data/words';
import type { PlayerState } from './run';

export type SkillDuration = 'run' | 'battle' | 'instant';

export const DURATION_LABEL: Record<SkillDuration, string> = {
  run: '永続',
  battle: '戦闘中',
  instant: '単発',
};

/** スキルが変更できるプレイヤーの能力値 */
export interface PlayerStats {
  /** 攻撃力の倍率（加算で積む） */
  attackMult: number;
  defenseAdd: number;
  defenseCapAdd: number;
  /** ミスのペナルティ（ゲージ・猶予の減少量）の倍率 */
  penaltyMult: number;
}

/** 攻撃ワードの抽選の重み。スキルが書き換える */
export interface WordWeights {
  /** 文字数ごとの重み */
  length: Record<number, number>;
  /** 種類ごとの倍率 */
  kind: Record<WordKind, number>;
}

export interface AttackInfo {
  length: number;
  kind: WordKind;
  misses: number;
  keys: number;
  kps: number;
  speedMult: number;
  accMult: number;
  lengthMult: number;
  perfect: boolean;
}

export interface DamageMods {
  mult: number;
  /** ダメージ表示に添えるスキル名 */
  tags: string[];
}

export interface DefenseInfo {
  length: number;
  progress: number;
  completed: boolean;
  perfect: boolean;
  misses: number;
  rate: number;
  damage: number;
}

/** スキルから戦闘に働きかけるための窓口（Battle が実装する） */
export interface SkillHost {
  readonly attacksThisBattle: number;
  healPlayer(amount: number): void;
}

export interface SkillInstance {
  def: SkillDef;
  stacks: number;
  /** ラン中ずっと保持する状態 */
  run: Record<string, number>;
  /** 戦闘ごとにリセットされる状態 */
  battle: Record<string, number>;
}

export interface SkillHooks {
  onAcquire?(s: SkillInstance, player: PlayerState): void;
  stats?(s: SkillInstance, stats: PlayerStats): void;
  wordWeights?(s: SkillInstance, weights: WordWeights): void;
  /** true を返すとそのミスを無効化する */
  onMiss?(s: SkillInstance, host: SkillHost): boolean;
  modifyAttack?(s: SkillInstance, info: AttackInfo, mods: DamageMods, host: SkillHost): void;
  afterAttack?(s: SkillInstance, info: AttackInfo, damage: number, host: SkillHost): void;
  onDefense?(s: SkillInstance, info: DefenseInfo, host: SkillHost): void;
  onDamaged?(s: SkillInstance, amount: number, host: SkillHost): void;
}

export interface SkillDef {
  id: string;
  name: string;
  duration: SkillDuration;
  maxStacks: number;
  /** stacks 個重ねたときの効果説明 */
  description(stacks: number): string;
  /** 所持スキル一覧に出す現在の状態 */
  status?(s: SkillInstance): string;
  hooks: SkillHooks;
}

function boostLengths(weights: WordWeights, lengths: number[], ratio: number): void {
  for (const l of lengths) if (weights.length[l] !== undefined) weights.length[l] *= 1 + ratio;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export const SKILLS: SkillDef[] = [
  // ---- 永続: 効果は小さめで、重ねるほど・ランが進むほど効く ----
  {
    id: 'short-training',
    name: '短文修行',
    duration: 'run',
    maxStacks: 3,
    description: (n) => `かな3〜4文字の攻撃ワードが出やすくなる（出現率 +${60 * n}%）`,
    hooks: { wordWeights: (s, w) => boostLengths(w, [3, 4], 0.6 * s.stacks) },
  },
  {
    id: 'long-training',
    name: '長文修行',
    duration: 'run',
    maxStacks: 3,
    description: (n) => `かな8文字以上の攻撃ワードが出やすくなる（出現率 +${60 * n}%）`,
    hooks: { wordWeights: (s, w) => boostLengths(w, [8, 9, 10, 11, 12], 0.6 * s.stacks) },
  },
  {
    id: 'discipline',
    name: '鍛錬',
    duration: 'run',
    maxStacks: 5,
    description: (n) => `攻撃力 +${8 * n}%`,
    hooks: { stats: (s, st) => void (st.attackMult += 0.08 * s.stacks) },
  },
  {
    id: 'accumulate',
    name: '積み重ね',
    duration: 'run',
    maxStacks: 3,
    description: (n) => `かな6文字以上の単語をノーミスで打つたび、このラン中の攻撃力が永続で +${n}%`,
    status: (s) => `現在 +${s.run.bonus ?? 0}%`,
    hooks: {
      stats: (s, st) => void (st.attackMult += (s.run.bonus ?? 0) / 100),
      afterAttack: (s, info) => {
        if (info.perfect && info.length >= 6) s.run.bonus = (s.run.bonus ?? 0) + s.stacks;
      },
    },
  },
  {
    id: 'iron-wall',
    name: '鉄壁',
    duration: 'run',
    maxStacks: 3,
    description: (n) => `防御率 +${5 * n}%（防御率の上限も +${3 * n}%）`,
    hooks: {
      stats: (s, st) => {
        st.defenseAdd += 0.05 * s.stacks;
        st.defenseCapAdd += 0.03 * s.stacks;
      },
    },
  },
  {
    id: 'focus',
    name: '集中',
    duration: 'run',
    maxStacks: 3,
    description: (n) => `ミスによる敵ゲージ・防御猶予の減少 -${25 * n}%`,
    hooks: { stats: (s, st) => void (st.penaltyMult *= 1 - 0.25 * s.stacks) },
  },
  {
    id: 'vitality',
    name: '生命力',
    duration: 'run',
    maxStacks: 5,
    description: (n) => `最大HP +${20 * n}（取得時にHPも20回復）`,
    hooks: {
      onAcquire: (_s, player) => {
        player.maxHp += 20;
        player.hp += 20;
      },
    },
  },
  {
    id: 'drain',
    name: '吸血',
    duration: 'run',
    maxStacks: 3,
    description: (n) => `ノーミスの攻撃で、与えたダメージの${5 * n}%だけHPを回復`,
    hooks: {
      afterAttack: (s, info, damage, host) => {
        if (info.perfect) host.healPlayer(Math.round(damage * 0.05 * s.stacks));
      },
    },
  },

  // ---- 戦闘中: 中くらいの効果。戦闘ごとにリセット ----
  {
    id: 'combo-form',
    name: '連撃の型',
    duration: 'battle',
    maxStacks: 2,
    description: (n) => `ノーミスで3単語連続するたび、この戦闘中の攻撃力 +${10 * n}%（最大5回）`,
    hooks: {
      modifyAttack: (s, _info, mods) => {
        if (s.battle.count) mods.mult *= 1 + 0.1 * s.stacks * s.battle.count;
      },
      afterAttack: (s, info) => {
        s.battle.streak = info.perfect ? (s.battle.streak ?? 0) + 1 : 0;
        if (s.battle.streak >= 3) {
          s.battle.streak = 0;
          s.battle.count = Math.min(5, (s.battle.count ?? 0) + 1);
        }
      },
    },
  },
  {
    id: 'fighting-spirit',
    name: '闘志',
    duration: 'battle',
    maxStacks: 3,
    description: (n) => `被弾するたび、この戦闘中の攻撃力 +${12 * n}%`,
    hooks: {
      modifyAttack: (s, _info, mods) => {
        if (s.battle.hits) mods.mult *= 1 + 0.12 * s.stacks * s.battle.hits;
      },
      onDamaged: (s) => void (s.battle.hits = (s.battle.hits ?? 0) + 1),
    },
  },
  {
    id: 'foresight',
    name: '見切り',
    duration: 'battle',
    maxStacks: 3,
    description: (n) => `各戦闘で最初の${2 * n}回のミスを無効化する（ペナルティなし）`,
    hooks: {
      onMiss: (s) => {
        if ((s.battle.used ?? 0) >= 2 * s.stacks) return false;
        s.battle.used = (s.battle.used ?? 0) + 1;
        return true;
      },
    },
  },
  {
    id: 'first-strike',
    name: '先制攻撃',
    duration: 'battle',
    maxStacks: 2,
    description: (n) => `各戦闘の最初の3回の攻撃が +${50 * n}%`,
    hooks: {
      modifyAttack: (s, _info, mods, host) => {
        if (host.attacksThisBattle < 3) {
          mods.mult *= 1 + 0.5 * s.stacks;
          mods.tags.push('先制');
        }
      },
    },
  },

  // ---- 単発: その攻撃だけの大きな倍率 ----
  {
    id: 'flash',
    name: '一閃',
    duration: 'instant',
    maxStacks: 3,
    description: (n) => `かな5文字以上の単語をノーミスで打つと、その攻撃が${fmt(1.5 + 0.5 * n)}倍`,
    hooks: {
      modifyAttack: (s, info, mods) => {
        if (info.perfect && info.length >= 5) {
          mods.mult *= 1.5 + 0.5 * s.stacks;
          mods.tags.push('一閃');
        }
      },
    },
  },
  {
    id: 'counter',
    name: '反撃の構え',
    duration: 'instant',
    maxStacks: 3,
    description: (n) => `防御をノーミスで完走すると、次の攻撃が${fmt(2 + 0.5 * n)}倍`,
    status: (s) => (s.battle.ready ? '発動待ち' : ''),
    hooks: {
      onDefense: (s, info) => {
        if (info.perfect) s.battle.ready = 1;
      },
      modifyAttack: (s, _info, mods) => {
        if (!s.battle.ready) return;
        s.battle.ready = 0;
        mods.mult *= 2 + 0.5 * s.stacks;
        mods.tags.push('反撃');
      },
    },
  },
  {
    id: 'godspeed',
    name: '神速',
    duration: 'instant',
    maxStacks: 3,
    description: (n) => `速度係数1.5以上（かな4.5文字/秒以上）の攻撃が${fmt(1.3 + 0.3 * n)}倍`,
    hooks: {
      modifyAttack: (s, info, mods) => {
        if (info.speedMult >= 1.5) {
          mods.mult *= 1.3 + 0.3 * s.stacks;
          mods.tags.push('神速');
        }
      },
    },
  },
  {
    id: 'all-out',
    name: '渾身の一撃',
    duration: 'instant',
    maxStacks: 2,
    description: (n) => `かな9文字以上の単語をノーミスで打つと、その攻撃が${2 + n}倍`,
    hooks: {
      modifyAttack: (s, info, mods) => {
        if (info.perfect && info.length >= 9) {
          mods.mult *= 2 + s.stacks;
          mods.tags.push('渾身');
        }
      },
    },
  },
];

// ---- 単語の種類ごとのスキル ----
// 珍しい種類ほど倍率を高くしている（出現率の目安: 単語57% / カタカナ語14% / 四字熟語9% / ことわざ5% / 文章15%）
const KIND_MASTER: Record<WordKind, { base: number; step: number }> = {
  word: { base: 1.2, step: 0.1 },
  katakana: { base: 1.5, step: 0.2 },
  idiom: { base: 1.8, step: 0.3 },
  proverb: { base: 2, step: 0.4 },
  sentence: { base: 1.5, step: 0.2 },
};

function kindFavor(kind: WordKind): SkillDef {
  const label = KIND_LABEL[kind];
  return {
    id: `kind-favor:${kind}`,
    name: `${label}の心得`,
    duration: 'run',
    maxStacks: 3,
    description: (n) => `${label}の攻撃ワードが出やすくなる（出現率 +${100 * n}%）`,
    hooks: { wordWeights: (s, w) => void (w.kind[kind] *= 1 + s.stacks) },
  };
}

function kindAvoid(kind: WordKind): SkillDef {
  const label = KIND_LABEL[kind];
  return {
    id: `kind-avoid:${kind}`,
    name: `${label}断ち`,
    duration: 'run',
    maxStacks: 3,
    description: (n) => `${label}の攻撃ワードが出にくくなる（出現率 -${Math.round((1 - 0.5 ** n) * 100)}%）`,
    hooks: { wordWeights: (s, w) => void (w.kind[kind] *= 0.5 ** s.stacks) },
  };
}

function kindMaster(kind: WordKind): SkillDef {
  const label = KIND_LABEL[kind];
  const { base, step } = KIND_MASTER[kind];
  const mult = (n: number) => base + step * (n - 1);
  return {
    id: `kind-master:${kind}`,
    name: `${label}の達人`,
    duration: 'instant',
    maxStacks: 3,
    description: (n) => `${label}の単語で攻撃すると、その攻撃が${fmt(mult(n))}倍`,
    hooks: {
      modifyAttack: (s, info, mods) => {
        if (info.kind !== kind) return;
        mods.mult *= mult(s.stacks);
        mods.tags.push(label);
      },
    },
  };
}

/**
 * 種類ごとのスキルは、同じ型（心得・断ち・達人）ごとにまとめる。
 * スキル候補には型ごとに1つだけ、種類をランダムに選んで出す。
 */
export const KIND_SKILL_GROUPS: SkillDef[][] = [kindFavor, kindAvoid, kindMaster].map((make) =>
  WORD_KINDS.map(make),
);

export const ALL_SKILLS: SkillDef[] = [...SKILLS, ...KIND_SKILL_GROUPS.flat()];
