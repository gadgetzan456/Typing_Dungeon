// ゲームバランスの数値はここにまとめる

export const BALANCE = {
  player: {
    maxHp: 100,
    baseAttack: 2,
  },
  run: {
    battlesPerRound: 5,
    rounds: 3,
    /** ラウンド切り替え時に、減っているHPのうち回復する割合 */
    roundHealRatio: 0.5,
  },
  attack: {
    /** 速度係数 1.0 になる速さ（かな/秒） */
    referenceKps: 3,
    minSpeedMult: 0.5,
    maxSpeedMult: 2,
    perfectAccMult: 1.2,
    minAccMult: 0.3,
    /** 測定時間の下限（秒）。極端な値を防ぐ */
    minWordTime: 0.3,
  },
  defense: {
    baseTime: 1,
    /** ラウンドごとの基準速度（かな/秒）。猶予時間 = baseTime + 文字数 / これ */
    kpsByRound: [2.5, 3, 3.5],
    bossKpsBonus: 0.3,
    progressWeight: 0.7,
    completeBonus: 0.1,
    speedBonus: 0.1,
    maxRate: 0.9,
    minLength: 4,
    maxLength: 8,
  },
  penalty: {
    /** 攻撃フェイズのミスで余計に減る敵ゲージ（秒） */
    attackGauge: 0.3,
    /** 防御フェイズのミスで減る猶予時間（秒） */
    defenseTime: 0.4,
  },
  battle: {
    introTime: 1.5,
  },
  /** 攻撃ワードの文字数ごとの出現重み */
  wordWeights: {
    3: 10, 4: 12, 5: 12, 6: 10, 7: 8, 8: 6, 9: 4, 10: 3, 11: 2, 12: 2,
  } as Record<number, number>,
};

export function speedMult(kps: number): number {
  const a = BALANCE.attack;
  return Math.min(a.maxSpeedMult, Math.max(a.minSpeedMult, kps / a.referenceKps));
}

export function accuracyMult(keys: number, misses: number): number {
  const a = BALANCE.attack;
  if (misses === 0) return a.perfectAccMult;
  const acc = keys / (keys + misses);
  return Math.max(a.minAccMult, acc ** 3);
}
