import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { Routine } from '../../../../core/models/gym.models';

export interface UserRoutinesDetailDialogData {
  userName: string;
  routines: Routine[];
}

@Component({
  selector: 'app-user-routines-detail-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './user-routines-detail-dialog.component.html',
  styleUrl: './user-routines-detail-dialog.component.scss'
})
export class UserRoutinesDetailDialogComponent {
  readonly data = inject<UserRoutinesDetailDialogData>(MAT_DIALOG_DATA);
}
