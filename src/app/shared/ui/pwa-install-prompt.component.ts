import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { PwaInstallService } from '../../core/services/pwa-install.service';

@Component({
  selector: 'app-pwa-install-prompt',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (pwa.showBanner()) {
      <aside class="install-prompt" role="dialog" aria-label="Instalar aplicación">
        <div class="install-prompt__icon">
          <mat-icon>install_mobile</mat-icon>
        </div>

        <div class="install-prompt__body">
          <strong class="install-prompt__title">Instala Nuvyra</strong>
          <p class="install-prompt__text">
            @if (pwa.canInstall()) {
              Añádela a tu pantalla de inicio y ábrela como una app, incluso sin conexión.
            } @else {
              Toca <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b> para instalarla.
            }
          </p>
        </div>

        <div class="install-prompt__actions">
          @if (pwa.canInstall()) {
            <button mat-flat-button type="button" (click)="install()">
              <mat-icon>download</mat-icon>
              Instalar
            </button>
          }
          <button mat-button type="button" (click)="pwa.dismiss()">Ahora no</button>
        </div>

        <button
          class="install-prompt__close"
          type="button"
          aria-label="Cerrar"
          (click)="pwa.dismiss()"
        >
          <mat-icon>close</mat-icon>
        </button>
      </aside>
    }
  `,
  styles: [
    `
      .install-prompt {
        position: fixed;
        left: 50%;
        bottom: 1rem;
        transform: translateX(-50%);
        z-index: 900;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 0.9rem 1rem;
        width: min(680px, calc(100vw - 1rem));
        padding: 0.9rem 1rem;
        border: 1px solid var(--app-border);
        border-radius: var(--cut);
        background: var(--app-surface-strong);
        box-shadow: var(--app-shadow);
        clip-path: polygon(
          0 0,
          calc(100% - var(--cut)) 0,
          100% var(--cut),
          100% 100%,
          var(--cut) 100%,
          0 calc(100% - var(--cut))
        );
        animation: install-prompt-in 0.25s var(--ease);
      }

      .install-prompt::before {
        content: '';
        position: absolute;
        inset: 0 0 auto 0;
        height: 3px;
        background: repeating-linear-gradient(
          -45deg,
          var(--brand-yellow) 0 8px,
          transparent 8px 16px
        );
        opacity: 0.9;
        pointer-events: none;
      }

      .install-prompt__icon {
        display: grid;
        place-items: center;
        width: 2.75rem;
        height: 2.75rem;
        border-radius: 3px;
        background: rgba(var(--brand-yellow-rgb), 0.16);
        border: 1px solid rgba(var(--brand-yellow-rgb), 0.4);
        color: var(--app-primary);
      }

      .install-prompt__title {
        display: block;
        font-family: var(--display-font);
        font-weight: 400;
        font-size: 1.05rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--app-text);
      }

      .install-prompt__text {
        margin: 0.15rem 0 0;
        color: var(--app-text-muted);
        font-size: 0.86rem;
        line-height: 1.35;
      }

      .install-prompt__text b {
        color: var(--app-primary);
      }

      .install-prompt__actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .install-prompt__actions mat-icon {
        margin-right: 0.25rem;
      }

      .install-prompt__close {
        position: absolute;
        top: 0.35rem;
        right: 0.35rem;
        display: grid;
        place-items: center;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--app-text-faint);
        cursor: pointer;
      }

      .install-prompt__close:hover {
        color: var(--app-primary);
      }

      @keyframes install-prompt-in {
        from {
          opacity: 0;
          transform: translate(-50%, 1rem);
        }
        to {
          opacity: 1;
          transform: translate(-50%, 0);
        }
      }

      @media (max-width: 620px) {
        .install-prompt {
          grid-template-columns: auto 1fr;
          padding: 0.9rem;
        }

        .install-prompt__actions {
          grid-column: 1 / -1;
          justify-content: flex-end;
        }
      }
    `
  ]
})
export class PwaInstallPromptComponent {
  readonly pwa = inject(PwaInstallService);

  install(): void {
    void this.pwa.install();
  }
}
