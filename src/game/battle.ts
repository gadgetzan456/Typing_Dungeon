import type { Word } from '../data/words';
import { RomajiInput } from '../romaji/engine';
import { BALANCE, accuracyMult, lengthMult, speedMult } from './balance';
import type { Enemy } from './enemies';
import type { Run } from './run';
import type { AttackInfo, DamageMods, DefenseInfo, SkillHost } from './skills';

export type Phase = 'intro' | 'attack' | 'defense' | 'won' | 'lost';

export type BattleEvent =
  | { type: 'attack'; damage: number; tags: string[]; info: AttackInfo }
  | { type: 'defenseStart' }
  | { type: 'defense'; damage: number; rate: number; perfect: boolean; completed: boolean }
  | { type: 'miss'; nullified: boolean }
  | { type: 'heal'; amount: number }
  | { type: 'won' }
  | { type: 'lost' };

export type KeyOutcome = 'hit' | 'miss' | 'ignored';

interface Typing {
  word: Word;
  input: RomajiInput;
  misses: number;
}

function startTyping(word: Word): Typing {
  return { word, input: new RomajiInput(word.reading), misses: 0 };
}

/** 1回の戦闘。DOM に依存せず、tick と key で進む */
export class Battle implements SkillHost {
  readonly enemy: Enemy;
  phase: Phase = 'intro';
  introLeft = BALANCE.battle.introTime;
  /** 敵の攻撃までの残り秒数 */
  gauge: number;
  attack: Typing;
  /** 攻撃ワードが表示されてからの時間 */
  attackTime = 0;
  defense: Typing | null = null;
  defenseLimit = 0;
  defenseLeft = 0;
  /** 残り時間がある間はミスを判定しない */
  missGraceLeft = 0;
  attacksThisBattle = 0;
  private events: BattleEvent[] = [];

  constructor(private readonly run: Run) {
    this.enemy = run.createEnemy();
    this.gauge = this.enemy.interval;
    this.attack = startTyping(run.pickAttackWord());
    for (const s of run.skills) s.battle = {};
  }

  /** いま入力対象になっているワード */
  get current(): Typing {
    return this.phase === 'defense' && this.defense ? this.defense : this.attack;
  }

  drainEvents(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  healPlayer(amount: number): void {
    const p = this.run.player;
    const healed = Math.min(amount, p.maxHp - p.hp);
    if (healed <= 0) return;
    p.hp += healed;
    this.events.push({ type: 'heal', amount: healed });
  }

  tick(dt: number): void {
    switch (this.phase) {
      case 'intro':
        this.introLeft -= dt;
        if (this.introLeft <= 0) this.phase = 'attack';
        break;
      case 'attack':
        this.attackTime += dt;
        this.gauge -= dt;
        if (this.gauge <= 0) this.startDefense();
        break;
      case 'defense':
        this.defenseLeft -= dt;
        this.missGraceLeft -= dt;
        if (this.defenseLeft <= 0) this.resolveDefense(false);
        break;
    }
  }

  key(ch: string): KeyOutcome {
    if (this.phase !== 'attack' && this.phase !== 'defense') return 'ignored';
    const typing = this.current;
    const result = typing.input.input(ch);
    if (result.accepted) {
      if (result.completed) {
        if (this.phase === 'attack') this.resolveAttack();
        else this.resolveDefense(true);
      }
      return 'hit';
    }
    if (this.missGraceLeft > 0) return 'ignored';
    this.handleMiss(typing);
    return 'miss';
  }

  private handleMiss(typing: Typing): void {
    let nullified = false;
    for (const s of this.run.skills) {
      if (s.def.hooks.onMiss?.(s, this)) {
        nullified = true;
        break;
      }
    }
    this.events.push({ type: 'miss', nullified });
    if (nullified) return;

    typing.misses++;
    const mult = this.run.playerStats().penaltyMult;
    if (this.phase === 'attack') {
      this.gauge -= BALANCE.penalty.attackGauge * mult;
      if (this.gauge <= 0) this.startDefense();
    } else {
      this.defenseLeft -= BALANCE.penalty.defenseTime * mult;
      if (this.defenseLeft <= 0) this.resolveDefense(false);
    }
  }

  private resolveAttack(): void {
    const { word, input, misses } = this.attack;
    const keys = input.typed.length;
    const kps = word.length / Math.max(BALANCE.attack.minWordTime, this.attackTime);
    const info: AttackInfo = {
      length: word.length,
      kind: word.kind,
      theme: word.theme,
      weakness: word.theme === this.enemy.weakness,
      misses,
      keys,
      kps,
      speedMult: speedMult(kps),
      accMult: accuracyMult(keys, misses),
      lengthMult: lengthMult(word.length),
      perfect: misses === 0,
    };
    const mods: DamageMods = { mult: 1, tags: [] };
    if (info.weakness) {
      mods.mult *= BALANCE.attack.weaknessMult;
      mods.tags.push('弱点');
    }
    this.run.eachHook('modifyAttack', (h, s) => h(s, info, mods, this));
    const stats = this.run.playerStats();
    const damage = Math.max(
      1,
      Math.round(
        BALANCE.player.baseAttack *
          info.length *
          info.lengthMult *
          info.speedMult *
          info.accMult *
          stats.attackMult *
          mods.mult,
      ),
    );

    this.enemy.hp = Math.max(0, this.enemy.hp - damage);
    this.attacksThisBattle++;
    this.events.push({ type: 'attack', damage, tags: mods.tags, info });
    this.run.eachHook('afterAttack', (h, s) => h(s, info, damage, this));

    const rs = this.run.stats;
    rs.kana += word.length;
    rs.time += this.attackTime;
    rs.keys += keys;
    rs.misses += misses;
    rs.maxDamage = Math.max(rs.maxDamage, damage);

    if (this.enemy.hp <= 0) {
      this.phase = 'won';
      this.run.stats.battlesWon++;
      this.events.push({ type: 'won' });
      return;
    }
    this.attack = startTyping(this.run.pickAttackWord());
    this.attackTime = 0;
  }

  private startDefense(): void {
    const word = this.run.pickDefenseWord();
    const d = BALANCE.defense;
    const kps = d.kpsByRound[Math.min(this.run.round, d.kpsByRound.length) - 1] + (this.enemy.isBoss ? d.bossKpsBonus : 0);
    this.defense = startTyping(word);
    this.defenseLimit = d.baseTime + word.length / kps;
    this.defenseLeft = this.defenseLimit;
    this.missGraceLeft = d.missGraceTime;
    this.phase = 'defense';
    this.events.push({ type: 'defenseStart' });
  }

  private resolveDefense(completed: boolean): void {
    const typing = this.defense!;
    const d = BALANCE.defense;
    const stats = this.run.playerStats();
    const keys = typing.input.typed.length;
    const progress = typing.input.kanaDone / typing.input.kanaTotal;
    const acc = Math.min(1, accuracyMult(keys, typing.misses));
    const left = Math.max(0, this.defenseLeft);
    let rate = d.progressWeight * progress * acc + stats.defenseAdd;
    if (completed) rate += d.completeBonus + d.speedBonus * (left / this.defenseLimit);
    rate = Math.min(d.maxRate + stats.defenseCapAdd, Math.max(0, rate));

    const damage = Math.round(this.enemy.attack * (1 - rate));
    const p = this.run.player;
    p.hp = Math.max(0, p.hp - damage);
    const info: DefenseInfo = {
      length: typing.word.length,
      progress,
      completed,
      perfect: completed && typing.misses === 0,
      misses: typing.misses,
      rate,
      damage,
    };
    this.events.push({ type: 'defense', damage, rate, perfect: info.perfect, completed });
    this.run.eachHook('onDefense', (h, s) => h(s, info, this));
    if (damage > 0) this.run.eachHook('onDamaged', (h, s) => h(s, damage, this));

    const rs = this.run.stats;
    rs.kana += typing.input.kanaDone;
    rs.time += this.defenseLimit - left;
    rs.keys += keys;
    rs.misses += typing.misses;

    this.defense = null;
    this.missGraceLeft = 0;
    if (p.hp <= 0) {
      this.phase = 'lost';
      this.events.push({ type: 'lost' });
      return;
    }
    this.phase = 'attack';
    this.gauge = this.enemy.interval;
    // 打ちかけの攻撃ワードは捨てて、新しいワードで攻撃を再開する
    this.attack = startTyping(this.run.pickAttackWord());
    this.attackTime = 0;
  }
}
