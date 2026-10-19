import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/game/balance';
import { Battle } from '../src/game/battle';
import { Run } from '../src/game/run';
import { SKILLS } from '../src/game/skills';

function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const skill = (id: string) => SKILLS.find((s) => s.id === id)!;

function startedBattle(run = new Run(seeded())): Battle {
  const b = new Battle(run);
  b.tick(BALANCE.battle.introTime);
  return b;
}

/** 現在のワードをガイド通りに、1キーあたり dt 秒かけて打つ（途中でフェイズが変わったら止める） */
function typeCurrent(b: Battle, dt = 0.1): void {
  const typing = b.current;
  while (!typing.input.isComplete) {
    b.tick(dt);
    if (b.current !== typing) return;
    b.key(typing.input.nextKey!);
  }
}

function attackDamages(b: Battle) {
  return b.drainEvents().flatMap((e) => (e.type === 'attack' ? [e] : []));
}

describe('Battle', () => {
  it('導入中はキー入力を受け付けない', () => {
    const b = new Battle(new Run(seeded()));
    expect(b.key('a')).toBe('ignored');
    b.tick(BALANCE.battle.introTime);
    expect(b.phase).toBe('attack');
  });

  it('単語を打ち切ると攻撃し、ノーミスの方がダメージが大きい', () => {
    const b1 = startedBattle();
    typeCurrent(b1);
    const perfect = attackDamages(b1)[0];
    expect(perfect.info.perfect).toBe(true);

    const b2 = startedBattle();
    b2.key('#');
    typeCurrent(b2);
    const missed = attackDamages(b2)[0];
    expect(missed.info.misses).toBe(1);
    expect(missed.damage).toBeLessThan(perfect.damage);
  });

  it('速く打つほどダメージが大きい', () => {
    const fast = startedBattle();
    typeCurrent(fast, 0.05);
    const slow = startedBattle();
    typeCurrent(slow, 0.3);
    expect(attackDamages(fast)[0].damage).toBeGreaterThan(attackDamages(slow)[0].damage);
  });

  it('攻撃フェイズのミスで敵ゲージが減る', () => {
    const b = startedBattle();
    const before = b.gauge;
    b.key('#');
    expect(b.gauge).toBeCloseTo(before - BALANCE.penalty.attackGauge);
  });

  it('ゲージが尽きると防御フェイズになり、打ち切れば被ダメージが減る', () => {
    const run = new Run(seeded());
    const b = startedBattle(run);
    b.tick(b.gauge);
    expect(b.phase).toBe('defense');
    typeCurrent(b, 0.05);
    const ev = b.drainEvents().find((e) => e.type === 'defense')!;
    expect(ev.type === 'defense' && ev.completed && ev.perfect).toBe(true);
    expect(b.phase).toBe('attack');
    expect(run.player.hp).toBeGreaterThan(BALANCE.player.maxHp - b.enemy.attack * 0.2);
  });

  it('防御を打てなければ大きく被弾する', () => {
    const run = new Run(seeded());
    const b = startedBattle(run);
    b.tick(b.gauge);
    b.tick(b.defenseLimit);
    expect(run.player.hp).toBe(BALANCE.player.maxHp - b.enemy.attack);
  });

  it('防御中のミスで猶予時間が減る', () => {
    const b = startedBattle();
    b.tick(b.gauge);
    const before = b.defenseLeft;
    b.key('#');
    expect(b.defenseLeft).toBeCloseTo(before - BALANCE.penalty.defenseTime);
  });

  it('打ちかけの攻撃ワードは防御後も残る', () => {
    const b = startedBattle();
    const word = b.attack.word;
    b.key(b.current.input.nextKey!);
    b.tick(b.gauge);
    typeCurrent(b);
    expect(b.phase).toBe('attack');
    expect(b.attack.word).toBe(word);
    expect(b.attack.input.typed.length).toBe(1);
  });

  it('敵のHPが0になると勝利する', () => {
    const b = startedBattle();
    b.enemy.hp = 1;
    typeCurrent(b);
    expect(b.phase).toBe('won');
  });
});

describe('スキル', () => {
  it('単発スキルはその攻撃だけ倍率がかかる（一閃）', () => {
    const base = startedBattle(new Run(seeded(7)));
    const run = new Run(seeded(7));
    run.addSkill(skill('flash'));
    const b = startedBattle(run);
    base.enemy.hp = b.enemy.hp = 1e9;
    for (let i = 0; i < 6; i++) {
      typeCurrent(base);
      typeCurrent(b);
    }
    const plain = attackDamages(base);
    const boosted = attackDamages(b);
    plain.forEach((p, i) => {
      const e = boosted[i];
      if (p.info.length >= 5) {
        expect(e.tags).toContain('一閃');
        expect(e.damage).toBeGreaterThan(p.damage);
      } else {
        expect(e.damage).toBe(p.damage);
      }
    });
  });

  it('反撃の構え: 完璧な防御の後の1撃だけ強化される', () => {
    const run = new Run(seeded());
    run.addSkill(skill('counter'));
    const b = startedBattle(run);
    b.tick(b.gauge);
    typeCurrent(b, 0.05);
    typeCurrent(b);
    typeCurrent(b);
    const [first, second] = attackDamages(b);
    expect(first.tags).toContain('反撃');
    expect(second.tags).not.toContain('反撃');
  });

  it('見切り: 最初のミスを無効化する', () => {
    const run = new Run(seeded());
    run.addSkill(skill('foresight'));
    const b = startedBattle(run);
    const gauge = b.gauge;
    b.key('#');
    b.key('#');
    expect(b.gauge).toBe(gauge);
    b.key('#');
    expect(b.gauge).toBeLessThan(gauge);
    expect(b.attack.misses).toBe(1);
  });

  it('積み重ね: 6文字以上のノーミスでラン中の攻撃力が上がり続ける', () => {
    const run = new Run(seeded());
    run.addSkill(skill('accumulate'));
    const inst = run.skills[0];
    for (let i = 0; i < 20; i++) {
      const b = startedBattle(run);
      b.enemy.hp = 1e9;
      typeCurrent(b);
      const [ev] = attackDamages(b);
      if (ev.info.length >= 6) break;
    }
    expect(inst.run.bonus).toBe(1);
    expect(run.playerStats().attackMult).toBeCloseTo(1.01);
  });

  it('戦闘中スキルの状態は戦闘ごとにリセットされる', () => {
    const run = new Run(seeded());
    run.addSkill(skill('fighting-spirit'));
    const b = startedBattle(run);
    b.tick(b.gauge);
    b.tick(b.defenseLimit);
    expect(run.skills[0].battle.hits).toBe(1);
    new Battle(run);
    expect(run.skills[0].battle.hits).toBeUndefined();
  });

  it('文字数の出現率スキルで単語の長さが偏る', () => {
    const count = (run: Run) => {
      let short = 0;
      for (let i = 0; i < 2000; i++) if (run.pickAttackWord().length <= 4) short++;
      return short;
    };
    const base = count(new Run(seeded(3)));
    const run = new Run(seeded(3));
    run.addSkill(skill('short-training'));
    run.addSkill(skill('short-training'));
    expect(count(run)).toBeGreaterThan(base * 1.3);
  });

  it('生命力: 最大HPとHPが増える', () => {
    const run = new Run(seeded());
    run.player.hp = 50;
    run.addSkill(skill('vitality'));
    expect(run.player.maxHp).toBe(120);
    expect(run.player.hp).toBe(70);
  });

  it('上限まで重ねたスキルは候補に出ない', () => {
    const run = new Run(seeded());
    const def = skill('counter');
    for (let i = 0; i < def.maxStacks; i++) run.addSkill(def);
    for (let i = 0; i < 50; i++) expect(run.skillOffers().map((d) => d.id)).not.toContain('counter');
  });
});

describe('Run', () => {
  it('5戦でラウンドが進み、減ったHPの半分を回復する', () => {
    const run = new Run(seeded());
    for (let i = 0; i < 4; i++) expect(run.advance()).toBe('next');
    expect(run.isBossBattle).toBe(true);
    run.player.hp = 40;
    expect(run.advance()).toBe('roundClear');
    expect(run.round).toBe(2);
    expect(run.battle).toBe(1);
    expect(run.player.hp).toBe(70);
  });

  it('3ラウンド目のボスに勝つとクリア', () => {
    const run = new Run(seeded());
    run.round = 3;
    run.battle = 5;
    expect(run.isFinalBattle).toBe(true);
    expect(run.advance()).toBe('cleared');
  });

  it('スキル候補は重複しない3つ', () => {
    const run = new Run(seeded());
    const offers = run.skillOffers();
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((d) => d.id)).size).toBe(3);
  });
});
