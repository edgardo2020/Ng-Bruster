import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dismissedKey = 'pwa-install-dismissed';
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly canInstall = signal(false);
  readonly isStandalone = signal(false);
  readonly isIOS = signal(false);
  readonly dismissed = signal(false);

  readonly showBanner = computed(
    () => {
      if (this.dismissed() || this.isStandalone()) {
        return false;
      }
      return this.canInstall() || this.isIOS();
    }
  );

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.isStandalone.set(this.detectStandalone());
    this.isIOS.set(this.detectIOS());
    this.dismissed.set(localStorage.getItem(this.dismissedKey) === 'true');

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      if (!this.dismissed() && !this.isStandalone()) {
        this.canInstall.set(true);
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      this.persistDismissed();
    });
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);

    if (outcome === 'dismissed') {
      this.dismiss();
    }

    return outcome === 'accepted';
  }

  dismiss(): void {
    this.canInstall.set(false);
    this.persistDismissed();
  }

  private persistDismissed(): void {
    this.dismissed.set(true);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.dismissedKey, 'true');
    }
  }

  private detectStandalone(): boolean {
    const displayMode = window.matchMedia('(display-mode: standalone)').matches;
    const navigator = window.navigator as { standalone?: boolean };
    const iosStandalone = navigator.standalone === true;
    return displayMode || iosStandalone;
  }

  private detectIOS(): boolean {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }
}
