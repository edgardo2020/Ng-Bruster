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
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.12);
      margin-bottom: 1rem;

      mat-icon {
        color: #dc2626;
        font-size: 1.8rem;
        width: 1.8rem;
        height: 1.8rem;
      }
    }

    .expired-dialog__title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0 0 0.6rem;
    }

    .expired-dialog__message {
      font-size: 0.95rem;
      color: #555;
      line-height: 1.5;
      margin: 0 0 1.6rem;
    }

    .expired-dialog__btn {
      background: #dc2626;
      color: #fff;
      font-weight: 600;
      border-radius: 10px;
      padding: 0.5rem 2rem;
      font-size: 0.95rem;
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
