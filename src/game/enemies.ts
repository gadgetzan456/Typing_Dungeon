export interface EnemyTemplate {
  name: string;
  emoji: string;
  hp: number;
  attack: number;
  /** 攻撃までの秒数 */
  interval: number;
}

export interface Enemy extends EnemyTemplate {
  maxHp: number;
  isBoss: boolean;
}

const NORMALS: EnemyTemplate[][] = [
  [
    { name: 'スライム', emoji: '🦠', hp: 55, attack: 10, interval: 7.5 },
    { name: 'コウモリ', emoji: '🦇', hp: 45, attack: 9, interval: 6.5 },
    { name: 'ネズミ', emoji: '🐀', hp: 50, attack: 11, interval: 7 },
    { name: 'キノコ', emoji: '🍄', hp: 65, attack: 10, interval: 8 },
  ],
  [
    { name: 'スケルトン', emoji: '💀', hp: 60, attack: 11, interval: 7 },
    { name: 'ゴースト', emoji: '👻', hp: 50, attack: 12, interval: 6.5 },
    { name: 'オオカミ', emoji: '🐺', hp: 55, attack: 13, interval: 6.5 },
    { name: 'ゾンビ', emoji: '🧟', hp: 70, attack: 11, interval: 7.5 },
  ],
  [
    { name: 'サソリ', emoji: '🦂', hp: 55, attack: 13, interval: 6.5 },
    { name: 'トロール', emoji: '🧌', hp: 75, attack: 12, interval: 7.5 },
    { name: 'オーガ', emoji: '👹', hp: 70, attack: 13, interval: 7 },
    { name: 'ゴーレム', emoji: '🗿', hp: 85, attack: 12, interval: 8 },
  ],
];

const BOSSES: EnemyTemplate[] = [
  { name: 'ゴブリンキング', emoji: '👺', hp: 140, attack: 13, interval: 7 },
  { name: 'ヴァンパイア', emoji: '🧛', hp: 150, attack: 14, interval: 6.5 },
  { name: '魔王', emoji: '😈', hp: 170, attack: 15, interval: 6.5 },
];

/** round: 1〜, battle: 1〜5（5 がボス） */
export function createEnemy(round: number, battle: number, isBoss: boolean, rng: () => number): Enemy {
  const r = Math.min(round, NORMALS.length) - 1;
  const pool = NORMALS[r];
  const t = isBoss ? BOSSES[r] : pool[Math.floor(rng() * pool.length)];
  const roundScaleHp = 1.7 ** (round - 1);
  const roundScaleAtk = 1.35 ** (round - 1);
  const battleScale = 1 + 0.15 * (battle - 1);
  const hp = Math.round(t.hp * roundScaleHp * battleScale);
  return {
    ...t,
    hp,
    maxHp: hp,
    attack: Math.round(t.attack * roundScaleAtk * battleScale),
    interval: Math.max(4.5, t.interval - 0.25 * (round - 1)),
    isBoss,
  };
}
