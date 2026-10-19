export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** 一定時間で消える浮き文字を表示する */
export function popup(container: HTMLElement, text: string, className: string, duration = 1000): void {
  const p = el('div', `popup ${className}`, text);
  p.style.left = `${40 + Math.random() * 20}%`;
  container.append(p);
  setTimeout(() => p.remove(), duration);
}

/** アニメーション用クラスを付け直す */
export function flash(target: HTMLElement, className: string): void {
  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
}
