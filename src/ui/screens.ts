import { BALANCE } from '../game/balance';
import type { Run } from '../game/run';
import { DURATION_LABEL, type SkillDef } from '../game/skills';
import type { App, Screen } from './app';
import { el, escapeHtml } from './dom';

const isConfirm = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';

export function titleScreen(app: App): Screen {
  const root = el('div', 'screen title');
  root.innerHTML = `
    <div class="title-card">
      <div class="title-emoji">🗡️⌨️🐉</div>
      <h1>Typing Dungeon</h1>
      <p class="subtitle">タイピング × ローグライク</p>
      <ul class="rules">
        <li>単語を打ち切ると攻撃。<b>速く・正確に</b>打つほど大ダメージ</li>
        <li>敵の攻撃ゲージが尽きると<b>防御フェイズ</b>。打てた分だけ被ダメージが減る</li>
        <li>ミスすると敵の攻撃が早まり、防御の猶予も減る</li>
        <li>勝つたびに3つのスキルから1つを選んで強くなる</li>
        <li>${BALANCE.run.battlesPerRound}戦で1ラウンド、${BALANCE.run.rounds}ラウンド目のボスを倒せばクリア</li>
      </ul>
      <p class="notice">※ 日本語入力（IME）はオフにして遊んでください</p>
      <button class="start">Enter / Space でスタート</button>
    </div>`;
  root.querySelector('button')!.addEventListener('click', () => app.newRun());
  return {
    el: root,
    onKey(e) {
      if (!isConfirm(e)) return;
      e.preventDefault();
      app.newRun();
    },
  };
}

function skillCard(def: SkillDef, nextStacks: number, index: number): string {
  const lv = nextStacks > 1 ? `Lv${nextStacks - 1} → Lv${nextStacks}` : 'NEW';
  return `
    <button class="skill-card dur-${def.duration}" data-index="${index}">
      <div class="skill-key">${index + 1}</div>
      <div class="skill-head">
        <span class="tag dur-${def.duration}">${DURATION_LABEL[def.duration]}</span>
        <span class="lv">${lv}</span>
      </div>
      <h3>${escapeHtml(def.name)}</h3>
      <p>${escapeHtml(def.description(nextStacks))}</p>
    </button>`;
}

export function skillScreen(app: App, run: Run): Screen {
  const offers = run.skillOffers();
  const root = el('div', 'screen skill-select');
  root.innerHTML = `
    <h2>勝利！ スキルを1つ選んでください</h2>
    <p class="muted">HP ${run.player.hp} / ${run.player.maxHp}</p>
    <div class="skill-cards">
      ${offers.map((d, i) => skillCard(d, run.stacksOf(d.id) + 1, i)).join('')}
    </div>
    <p class="hint">数字キー 1〜${offers.length} またはクリックで選択</p>`;

  let chosen = false;
  const choose = (i: number) => {
    if (chosen || !offers[i]) return;
    chosen = true;
    run.addSkill(offers[i]);
    app.onSkillChosen();
  };
  root.querySelectorAll<HTMLButtonElement>('.skill-card').forEach((b) =>
    b.addEventListener('click', () => choose(Number(b.dataset.index))),
  );
  // スキル候補が尽きた場合はそのまま次へ
  if (offers.length === 0) {
    root.querySelector('.skill-cards')!.innerHTML = '<p>すべてのスキルを極めました！ Enter で次へ</p>';
  }
  return {
    el: root,
    onKey(e) {
      if (offers.length === 0 && isConfirm(e)) app.onSkillChosen();
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1) choose(n - 1);
    },
  };
}

export function roundClearScreen(app: App, run: Run): Screen {
  const root = el('div', 'screen round-clear');
  root.innerHTML = `
    <div class="overlay-card">
      <h2>ラウンド ${run.round - 1} クリア！</h2>
      <p>休息して HP が <b class="heal">${run.lastHeal}</b> 回復した</p>
      <p class="big">HP ${run.player.hp} / ${run.player.maxHp}</p>
      <p>次はラウンド ${run.round}。敵はさらに強くなる……</p>
      <button>Enter で進む</button>
    </div>`;
  root.querySelector('button')!.addEventListener('click', () => app.goBattle());
  return {
    el: root,
    onKey(e) {
      if (!isConfirm(e)) return;
      e.preventDefault();
      app.goBattle();
    },
  };
}

export function resultScreen(app: App, run: Run, cleared: boolean): Screen {
  const s = run.stats;
  const kps = s.time > 0 ? s.kana / s.time : 0;
  const acc = s.keys + s.misses > 0 ? (s.keys / (s.keys + s.misses)) * 100 : 100;
  const root = el('div', `screen result ${cleared ? 'cleared' : 'gameover'}`);
  root.innerHTML = `
    <div class="overlay-card">
      <h2>${cleared ? '🏆 ダンジョン踏破！' : '💀 ゲームオーバー'}</h2>
      <p>到達: ラウンド ${run.round} ・ 戦闘 ${run.battle} ／ 撃破 ${s.battlesWon}体</p>
      <dl class="stats">
        <dt>平均速度</dt><dd>${kps.toFixed(2)} かな/秒</dd>
        <dt>正確さ</dt><dd>${acc.toFixed(1)}%</dd>
        <dt>打鍵数</dt><dd>${s.keys}（ミス ${s.misses}）</dd>
        <dt>最大ダメージ</dt><dd>${s.maxDamage}</dd>
      </dl>
      <h3>獲得スキル</h3>
      <p class="skills-owned">${
        run.skills.map((sk) => `${escapeHtml(sk.def.name)} Lv${sk.stacks}`).join(' ／ ') || 'なし'
      }</p>
      <button>Enter でタイトルへ</button>
    </div>`;
  root.querySelector('button')!.addEventListener('click', () => app.goTitle());
  return {
    el: root,
    onKey(e) {
      if (!isConfirm(e)) return;
      e.preventDefault();
      app.goTitle();
    },
  };
}
