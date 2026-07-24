import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'theme-preference';

  readonly isDark = signal(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(this.storageKey);
      if (stored !== null) {
        this.isDark.set(stored === 'dark');
      } else {
        this.isDark.set(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    }

    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        const dark = this.isDark();
        document.body.classList.toggle('dark-theme', dark);
        localStorage.setItem(this.storageKey, dark ? 'dark' : 'light');
      }
    });
  }

  toggle(): void {
    this.isDark.update((v) => !v);
  }

  setDark(value: boolean): void {
    this.isDark.set(value);
  }
}