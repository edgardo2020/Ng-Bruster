import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="page-header">
      <div>
       <!-- <p class="page-header__eyebrow">Gym Management System</p>-->
        <h1>{{ title() }}</h1>
        <p>{{ subtitle() }}</p>
      </div>
    </header>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1.25rem;
        padding-bottom: 0.9rem;
        position: relative;
      }

      .page-header::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        width: 96px;
        height: 4px;
        background: repeating-linear-gradient(
          -45deg,
          var(--brand-yellow) 0 8px,
          transparent 8px 16px
        );
      }

      @media (max-width: 720px) {
        .page-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .page-header__meta {
          align-self: flex-start;
          margin-top: 0.5rem;
        }
      }

      .page-header__eyebrow {
        margin: 0 0 0.35rem;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--app-primary);
      }

      h1 {
        margin: 0;
        font-family: var(--display-font);
        font-weight: 400;
        font-size: clamp(1.75rem, 3.4vw, 2.6rem);
        line-height: 1;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--app-text);
      }

      p {
        margin: 0.45rem 0 0 0;
        max-width: 52rem;
        font-size: 0.95rem;
        color: var(--app-text-muted);
      }

      .page-header__meta {
        padding: 0.55rem 0.9rem;
        border-radius: 3px;
        border: 1px solid var(--app-border);
        background: var(--surface-sunken);
        color: var(--app-text-muted);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        white-space: nowrap;
      }
    `
  ]
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly meta = input<string>('');
}