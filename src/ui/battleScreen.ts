import { BALANCE } from '../game/balance';
import { Battle, type BattleEvent } from '../game/battle';
import type { Run } from '../game/run';
import { DURATION_LABEL } from '../game/skills';
import type { App, Screen } from './app';
import { el, escapeHtml, flash, popup } from './dom';
import { KeyboardView } from './keyboard';

const END_DELAY = 1.4;

function bar(className: string): { root: HTMLElement; fill: HTMLElement; label: HTMLElement } {
  const root = el('div', `bar ${className}`);
  const fill = el('div', 'bar-fill');
  const label = el('div', 'bar-label');
  root.append(fill, label);
  return { root, fill, label };
}

export class BattleScreen implements Screen {
  readonly el = el('div', 'screen battle');
  private readonly battle: Battle;
  private readonly keyboard = new KeyboardView();
  private paused = false;
  private endTimer = 0;
  private lastWordKey = '';

  private playerHp = bar('hp player-hp');
  private enemyHp = bar('hp enemy-hp');
  private gauge = bar('gauge');
  private defenseTimer = bar('defense-timer');
  private enemyEl = el('div', 'enemy');
  private enemyEmoji = el('div', 'enemy-emoji');
  private popups = el('div', 'popups');
  private playerPopups = el('div', 'popups');
  private banner = el('div', 'banner');
  private wordBox = el('div', 'word-box');
  private wordDisplay = el('div', 'word-display');
  private wordKana = el('div', 'word-kana');
  private wordRomaji = el('div', 'word-romaji');
  private lastAttack = el('div', 'last-attack');
  private skillList = el('div', 'skill-list');
  private pauseOverlay = el('div', 'overlay pause', '');

  constructor(
    private readonly app: App,
    private readonly run: Run,
  ) {
    this.battle = new Battle(run);
    const enemy = this.battle.enemy;

    const progress = el('div', 'progress');
    for (let i = 1; i <= BALANCE.run.battlesPerRound; i++) {
      const isBoss = i === BALANCE.run.battlesPerRound;
      const state = i < run.battle ? 'done' : i === run.battle ? 'current' : '';
      progress.append(el('span', `step ${state} ${isBoss ? 'boss' : ''}`, isBoss ? '👑' : String(i)));
    }
    const hud = el('header', 'hud');
    const roundLabel = el('div', 'round-label', `ラウンド ${run.round} / ${BALANCE.run.rounds}`);
    const playerBox = el('div', 'player-box');
    playerBox.append(el('div', 'player-name', 'あなた'), this.playerHp.root, this.playerPopups);
    hud.append(roundLabel, progress, playerBox);

    this.enemyEmoji.textContent = enemy.emoji;
    const name = el('div', 'enemy-name', enemy.isBoss ? `BOSS ${enemy.name}` : enemy.name);
    this.enemyEl.append(name, this.enemyEmoji, this.enemyHp.root, this.gauge.root);
    if (enemy.isBoss) this.enemyEl.classList.add('boss');
    const arena = el('section', 'arena');
    arena.append(this.enemyEl, this.popups, this.banner);

    this.wordBox.append(el('div', 'defense-label', '敵の攻撃！ 打ち切って防御せよ！'), this.wordDisplay, this.wordKana, this.wordRomaji, this.defenseTimer.root);

    this.pauseOverlay.innerHTML = '<div class="overlay-card"><h2>一時停止</h2><p>Esc で再開</p></div>';

    const main = el('div', 'battle-main');
    main.append(hud, arena, this.wordBox, this.lastAttack, this.keyboard.el);
    const side = el('aside', 'battle-side');
    side.append(el('h3', '', 'スキル'), this.skillList, el('p', 'hint', 'Esc: 一時停止'));
    this.el.append(main, side, this.pauseOverlay);

    this.showBanner(enemy.isBoss ? `BOSS ${enemy.name}` : `${enemy.name} が現れた！`, 'intro');
    this.renderSkills();
    this.render();
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.battle.phase === 'attack' || this.battle.phase === 'defense' || this.battle.phase === 'intro') {
        this.paused = !this.paused;
        this.pauseOverlay.classList.toggle('show', this.paused);
      }
      return;
    }
    if (e.key.length !== 1 || this.paused) return;
    e.preventDefault();
    const outcome = this.battle.key(e.key);
    if (outcome !== 'ignored') this.keyboard.press(e.key, outcome === 'hit');
    this.handleEvents(this.battle.drainEvents());
    this.render();
  }

  update(dt: number): void {
    if (this.paused) return;
    const phase = this.battle.phase;
    if (phase === 'won' || phase === 'lost') {
      this.endTimer += dt;
      if (this.endTimer >= END_DELAY) {
        if (phase === 'won') this.app.onBattleWon();
        else this.app.onBattleLost();
      }
      return;
    }
    const wasIntro = phase === 'intro';
    this.battle.tick(dt);
    if (wasIntro && this.battle.phase === 'attack') this.hideBanner();
    this.handleEvents(this.battle.drainEvents());
    this.render();
  }

  private handleEvents(events: BattleEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'attack': {
          const big = e.tags.length > 0;
          popup(this.popups, `${e.tags.map((t) => `${t}! `).join('')}${e.damage}`, big ? 'damage big' : 'damage');
          flash(this.enemyEmoji, 'hit');
          const i = e.info;
          this.lastAttack.textContent =
            `${i.length}文字  速度 ${i.kps.toFixed(1)}かな/秒 ×${i.speedMult.toFixed(2)}  ` +
            `精度 ×${i.accMult.toFixed(2)}${i.perfect ? '（ノーミス）' : `（ミス${i.misses}）`}`;
          break;
        }
        case 'defenseStart':
          flash(this.enemyEmoji, 'charge');
          break;
        case 'defense': {
          const pct = Math.round(e.rate * 100);
          const label = e.perfect ? `完璧な防御！ ${pct}%` : `防御 ${pct}%`;
          popup(this.popups, label, e.perfect ? 'guard perfect' : 'guard');
          if (e.damage > 0) {
            popup(this.playerPopups, `-${e.damage}`, 'hurt');
            flash(this.el, 'shake');
          }
          this.renderSkills();
          break;
        }
        case 'miss':
          if (e.nullified) popup(this.popups, '見切り', 'nullified', 600);
          else flash(this.wordBox, 'miss-flash');
          break;
        case 'heal':
          popup(this.playerPopups, `+${e.amount}`, 'heal');
          break;
        case 'won':
          this.showBanner('勝利！', 'win');
          this.enemyEl.classList.add('defeated');
          break;
        case 'lost':
          this.showBanner('力尽きた……', 'lose');
          break;
      }
    }
    if (events.some((e) => e.type === 'attack')) this.renderSkills();
  }

  private showBanner(text: string, kind: string): void {
    this.banner.textContent = text;
    this.banner.className = `banner show ${kind}`;
  }

  private hideBanner(): void {
    this.banner.classList.remove('show');
  }

  private render(): void {
    const b = this.battle;
    const p = this.run.player;
    setBar(this.playerHp, p.hp / p.maxHp, `HP ${p.hp} / ${p.maxHp}`);
    setBar(this.enemyHp, b.enemy.hp / b.enemy.maxHp, `HP ${b.enemy.hp} / ${b.enemy.maxHp}`);
    const gaugeLeft = b.phase === 'defense' ? 0 : Math.max(0, b.gauge);
    setBar(this.gauge, gaugeLeft / b.enemy.interval, `攻撃まで ${gaugeLeft.toFixed(1)}秒`);
    this.gauge.root.classList.toggle('low', gaugeLeft < 2);

    const defending = b.phase === 'defense';
    this.wordBox.classList.toggle('defense', defending);
    this.enemyEl.classList.toggle('attacking', defending);
    if (defending) {
      setBar(this.defenseTimer, b.defenseLeft / b.defenseLimit, `残り ${Math.max(0, b.defenseLeft).toFixed(1)}秒`);
    }

    const { word, input } = b.current;
    const key = `${b.phase === 'defense'}|${word.reading}|${input.typed}`;
    if (key !== this.lastWordKey) {
      this.lastWordKey = key;
      this.wordDisplay.textContent = word.display;
      const done = input.kanaDone;
      this.wordKana.innerHTML =
        `<span class="done">${escapeHtml(input.kana.slice(0, done))}</span>` +
        `<span>${escapeHtml(input.kana.slice(done))}</span>`;
      const rest = input.remaining;
      this.wordRomaji.innerHTML =
        `<span class="done">${escapeHtml(input.typed)}</span>` +
        `<span class="next">${escapeHtml(rest.slice(0, 1))}</span>` +
        `<span>${escapeHtml(rest.slice(1))}</span>`;
    }
    const active = b.phase === 'attack' || b.phase === 'defense';
    this.keyboard.highlight(active ? input.nextKey : null);
  }

  private renderSkills(): void {
    if (this.run.skills.length === 0) {
      this.skillList.innerHTML = '<p class="muted">まだスキルはありません</p>';
      return;
    }
    this.skillList.innerHTML = this.run.skills
      .map((s) => {
        const status = s.def.status?.(s);
        return (
          `<div class="skill-chip dur-${s.def.duration}">` +
          `<div class="skill-chip-head"><span class="tag dur-${s.def.duration}">${DURATION_LABEL[s.def.duration]}</span>` +
          `<b>${escapeHtml(s.def.name)}</b><span class="lv">Lv${s.stacks}</span></div>` +
          `<div class="skill-chip-desc">${escapeHtml(s.def.description(s.stacks))}</div>` +
          (status ? `<div class="skill-chip-status">${escapeHtml(status)}</div>` : '') +
          `</div>`
        );
      })
      .join('');
  }
}

function setBar(b: { fill: HTMLElement; label: HTMLElement }, ratio: number, label: string): void {
  b.fill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  b.label.textContent = label;
}
