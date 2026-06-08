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
      }

      .stat-card__icon {
        display: grid;
        place-items: center;
        width: 3rem;
        height: 3rem;
        border-radius: 1rem;
        background: color-mix(in srgb, var(--card-accent) 16%, white);
        color: var(--card-accent);
      }

      .stat-card__label,
      .stat-card__trend {
        margin: 0;
      }

      .stat-card__label {
        color: var(--app-text-muted);
        font-size: 0.88rem;
      }

      .stat-card__value {
        display: block;
        margin: 0.3rem 0;
        font-size: clamp(1.6rem, 2vw, 2.2rem);
        line-height: 1;
      }

      .stat-card__trend {
        color: var(--app-text-soft);
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