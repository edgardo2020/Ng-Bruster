import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <article class="stat-card card-surface" [style.--card-accent]="accent()">
      <div class="stat-card__icon">
        <mat-icon>{{ icon() }}</mat-icon>
      </div>
      <div>
        <p class="stat-card__label">{{ label() }}</p>
        <strong class="stat-card__value">{{ value() }}</strong>
        <p class="stat-card__trend">{{ trend() }}</p>
      </div>
    </article>
  `,
  styles: [
    `
      .stat-card {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 1rem;
        align-items: center;
        overflow: hidden;
      }

      .stat-card::after {
        content: '';
        position: absolute;
        inset: auto 0 0 0;
        height: 3px;
        background: repeating-linear-gradient(
          -45deg,
          var(--card-accent) 0 8px,
          transparent 8px 16px
        );
        opacity: 0.85;
      }

      .stat-card__icon {
        display: grid;
        place-items: center;
        width: 3rem;
        height: 3rem;
        border-radius: 3px;
        background: color-mix(in srgb, var(--card-accent) 16%, transparent);
        border: 1px solid color-mix(in srgb, var(--card-accent) 38%, transparent);
        color: var(--card-accent);
      }

      .stat-card__label,
      .stat-card__trend {
        margin: 0;
      }

      .stat-card__label {
        color: var(--app-text-muted);
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .stat-card__value {
        display: block;
        margin: 0.25rem 0;
        font-family: var(--display-font);
        font-weight: 400;
        font-size: clamp(1.75rem, 2.4vw, 2.4rem);
        line-height: 1;
        letter-spacing: 0.01em;
      }

      .stat-card__trend {
        color: var(--app-text-soft);
        font-size: 0.82rem;
      }
    `
  ]
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly trend = input<string>('Sin variación registrada');
  readonly icon = input<string>('insights');
  readonly accent = input<string>('var(--app-primary)');
}