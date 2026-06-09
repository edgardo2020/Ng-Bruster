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
        margin-bottom: .5rem;
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
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--app-primary);
      }

      h1 {
        margin: 0;
        font-family: var(--display-font);
        font-size: clamp(1rem, 2vw, 2rem);
        line-height: 1;
      }

      p {
        margin: 0.2rem 0 0 0;
        max-width: 52rem;
        color: var(--app-text-muted);
      }

      .page-header__meta {
        padding: 0.65rem 1rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(18, 36, 58, 0.08);
        color: var(--app-text-muted);
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