import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'stock-dashboard.theme';

/**
 * Resolves the theme from, in order: a `?theme=` query parameter (so a
 * particular look is linkable and scriptable), the last explicit choice, then
 * the operating system preference.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<Theme>(this.initial());

  constructor() {
    effect(() => {
      const theme = this.theme();
      this.document.documentElement.dataset['theme'] = theme;
      try {
        this.document.defaultView?.localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Private browsing and blocked storage are not errors worth surfacing.
      }
    });
  }

  toggle(): void {
    this.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  private initial(): Theme {
    const view = this.document.defaultView;
    const fromQuery = view?.location?.search
      ? new URLSearchParams(view.location.search).get('theme')
      : null;
    if (fromQuery === 'dark' || fromQuery === 'light') return fromQuery;
    try {
      const stored = view?.localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {
      // Fall through to the system preference.
    }
    return view?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
