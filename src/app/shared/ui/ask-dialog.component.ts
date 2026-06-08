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
      min-width: 320px;
      max-width: 370px;
      background: #fff;
      border-radius: 24px;
      box-shadow: 0 4px 24px 0 rgba(0,0,0,0.10);
      padding: 2.2rem 1.5rem 1.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .ask-dialog-modern__title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 0.7rem;
      color: #222;
    }
    .ask-dialog-modern__message {
      font-size: 1.02rem;
      color: #555;
      margin-bottom: 1.7rem;
    }
    .ask-dialog-modern__actions {
      display: flex;
      gap: 1rem;
      width: 100%;
      justify-content: center;
    }
    .ask-dialog-modern__close {
      background: #fff;
  color: #111;
  font-weight: 500;
  font-size: 14px;
  border-radius: 10px;
  min-width: 96px;
  padding: 10px 16px;
  border: 1px solid #e5e5e5;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  cursor: pointer;
    }
    .ask-dialog-modern__close:hover {
      background: #e0e1e3 !important;
    }
    .ask-dialog-modern__confirm {
  background: #111;
  color: #fff;
  font-weight: 500;
  font-size: 14px;
  border-radius: 10px;
  min-width: 96px;
  padding: 10px 16px;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
  cursor: pointer;
}

.ask-dialog-modern__confirm:hover {
  background: #c0c0c0;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-1px);
}

.ask-dialog-modern__confirm:active {
  transform: translateY(0);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
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
