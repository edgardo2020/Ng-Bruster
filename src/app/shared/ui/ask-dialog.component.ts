import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-ask-dialog',
  standalone: true,
  imports: [MatDialogModule, MatIconModule],
  template: `
    <div class="ask-dialog-modern">
      <div class="ask-dialog-modern__title">{{ data.title || '¿Estás seguro?' }}</div>
      <div class="ask-dialog-modern__message">{{ data.message }}</div>
      <div class="ask-dialog-modern__actions">
        <button mat-flat-button class="ask-dialog-modern__close" (click)="onNo()">Cerrar</button>
        <button mat-raised-button class="ask-dialog-modern__confirm" (click)="onYes()">Confirmar</button>
      </div>
    </div>
  `,
  styles: [`
    .ask-dialog-modern {
      position: relative;
      min-width: 320px;
      max-width: 380px;
      padding: 2.25rem 1.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      border-radius: var(--cut);
      background: var(--app-surface-strong);
      color: var(--app-text);
      border: 1px solid var(--app-border);
      overflow: hidden;
    }

    .ask-dialog-modern::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 22px;
      height: 5px;
      background: repeating-linear-gradient(-45deg, #ffd400 0 9px, #0a0a0a 9px 18px);
    }

    .ask-dialog-modern__title {
      margin-bottom: 0.7rem;
      font-family: var(--display-font);
      font-weight: 400;
      font-size: 1.35rem;
      line-height: 1.1;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--app-text);
    }

    .ask-dialog-modern__message {
      margin-bottom: 1.7rem;
      font-size: 0.98rem;
      color: var(--app-text-muted);
    }

    .ask-dialog-modern__actions {
      display: flex;
      gap: 0.75rem;
      width: 100%;
      justify-content: center;
    }

    .ask-dialog-modern__close {
      min-width: 104px;
      padding: 10px 16px;
      border-radius: 3px;
      font-weight: 700;
      font-size: 0.82rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .ask-dialog-modern__confirm {
      min-width: 104px;
      padding: 10px 16px;
      border-radius: 3px;
      font-weight: 700;
      font-size: 0.82rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
    }
  `]
})
export class AskDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<AskDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: string; title?: string }
  ) {}

  onYes() {
    this.dialogRef.close(true);
  }
  onNo() {
    this.dialogRef.close(false);
  }
}
