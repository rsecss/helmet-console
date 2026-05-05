/**
 * View switcher — single owner of `.app-shell[data-view]` and the
 * `.view-toggle` button group's `aria-pressed` sync. Three views:
 * `'terminal' | 'ai' | 'panel'`. Mirrors the single-writer pattern that
 * `config-panel.js` uses for `data-state`.
 */

const VALID_VIEWS = new Set(['terminal', 'ai', 'panel']);

export function createViewSwitcher({ shell, buttons, onViewChange }) {
  function setView(name) {
    if (!VALID_VIEWS.has(name)) return;
    shell.dataset.view = name;
    buttons.forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.view === name ? 'true' : 'false');
    });
    if (onViewChange) onViewChange(name);
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setView(btn.dataset.view);
    });
  });

  return { setView };
}
