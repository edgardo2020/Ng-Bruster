import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.open(message, 'success-snackbar');
  }

  error(message: string): void {
    this.open(message, 'error-snackbar');
  }

  info(message: string): void {
    this.open(message, 'info-snackbar');
  }

  warning(message: string): void {
    this.open(message, 'warning-snackbar');
  }

  private open(message: string, panelClass: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3500,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass
    });
  }
}