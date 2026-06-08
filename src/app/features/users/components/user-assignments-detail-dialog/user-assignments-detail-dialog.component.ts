import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';

import { AssignmentDetail } from '../../../assignments/data-access/assignments-api.service';

export interface UserAssignmentsDetailDialogData {
  userName: string;
  assignments: AssignmentDetail[];
}

@Component({
  selector: 'app-user-assignments-detail-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatTableModule],
  templateUrl: './user-assignments-detail-dialog.component.html',
  styleUrl: './user-assignments-detail-dialog.component.scss'
})
export class UserAssignmentsDetailDialogComponent {
  readonly data = inject<UserAssignmentsDetailDialogData>(MAT_DIALOG_DATA);
  readonly assignmentColumns = ['planName', 'startDate', 'focus', 'intensity'];
}
