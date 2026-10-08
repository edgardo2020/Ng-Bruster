import { Component } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-expired-membership-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="expired-dialog">
      <div class="expired-dialog__icon">
        <mat-icon>lock_clock</mat-icon>
      </div>
      <h2 class="expired-dialog__title">Suscripción expirada</h2>
      <p class="expired-dialog__message">
        Tu membresía ha caducado. Por favor, contacta al administrador para renovarla y seguir disfrutando del servicio.
      </p>
      <button mat-flat-button class="expired-dialog__btn" (click)="accept()">
        Aceptar
      </button>
    </div>
  `,
  styles: [`
    .expired-dialog {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 2rem 1.75rem 1.75rem;
      min-width: 300px;
      max-width: 360px;
    }

    .expired-dialog__icon {
      display: grid;
      place-items: center;
      width: 3.5rem;
      height: 3.5rem;
      margin-bottom: 1rem;
      border-radius: 3px;
      background: rgba(226, 60, 30, 0.16);
      border: 1px solid rgba(226, 60, 30, 0.45);

      mat-icon {
        color: var(--brand-blood);
        font-size: 1.8rem;
        width: 1.8rem;
        height: 1.8rem;
      }
    }

    .expired-dialog__title {
      margin: 0 0 0.6rem;
      font-family: var(--display-font);
      font-weight: 400;
      font-size: 1.3rem;
      line-height: 1.1;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--app-text);
    }

    .expired-dialog__message {
      margin: 0 0 1.6rem;
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--app-text-muted);
    }

    .expired-dialog__btn {
      padding: 0.6rem 2rem;
      border-radius: 3px;
      background: var(--brand-blood);
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
  `]
})
export class ExpiredMembershipDialogComponent {
  constructor(private readonly dialogRef: MatDialogRef<ExpiredMembershipDialogComponent>) {
    dialogRef.disableClose = true;
  }

  accept(): void {
    this.dialogRef.close(true);
  }
}
