import { Run } from '../game/run';
import { BattleScreen } from './battleScreen';
import { el } from './dom';
import { resultScreen, roundClearScreen, skillScreen, titleScreen } from './screens';

export interface Screen {
  el: HTMLElement;
  onKey?(e: KeyboardEvent): void;
  update?(dt: number): void;
}

/** 画面遷移とキー入力・ゲームループを管理する */
export class App {
  run: Run | null = null;
  private screen: Screen | null = null;
  private last = 0;
  private toastEl = el('div', 'toast');
  private toastTimer = 0;

  constructor(private readonly root: HTMLElement) {}

  start(): void {
    document.body.append(this.toastEl);
    window.addEventListener('keydown', (e) => this.handleKey(e));
    requestAnimationFrame((t) => this.loop(t));
    this.goTitle();
  }

  private loop(t: number): void {
    const dt = this.last ? Math.min(0.1, (t - this.last) / 1000) : 0;
    this.last = t;
    this.screen?.update?.(dt);
    requestAnimationFrame((n) => this.loop(n));
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.isComposing || e.key === 'Process') {
      this.toast('日本語入力（IME）をオフにしてください');
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    this.screen?.onKey?.(e);
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2500);
  }

  private show(screen: Screen): void {
    this.screen = screen;
    this.root.replaceChildren(screen.el);
  }

  goTitle(): void {
    this.run = null;
    this.show(titleScreen(this));
  }

  newRun(): void {
    this.run = new Run();
    this.goBattle();
  }

  goBattle(): void {
    this.show(new BattleScreen(this, this.run!));
  }

  onBattleWon(): void {
    const run = this.run!;
    if (run.isFinalBattle) this.show(resultScreen(this, run, true));
    else this.show(skillScreen(this, run));
  }

  onBattleLost(): void {
    this.show(resultScreen(this, this.run!, false));
  }

  onSkillChosen(): void {
    const result = this.run!.advance();
    if (result === 'roundClear') this.show(roundClearScreen(this, this.run!));
    else this.goBattle();
  }
}
