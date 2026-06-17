import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { take } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { Routine } from '../../../../core/models/gym.models';
import { AskDialogComponent } from '../../../../shared/ui/ask-dialog.component';
import { RoutinesApiService } from '../../../routines/data-access/routines-api.service';

export interface UserRoutinesDetailDialogData {
  userName: string;
  routines: Routine[];
}

@Component({
  selector: 'app-user-routines-detail-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, AskDialogComponent],
  templateUrl: './user-routines-detail-dialog.component.html',
  styleUrl: './user-routines-detail-dialog.component.scss'
})
export class UserRoutinesDetailDialogComponent {
  readonly data = inject<UserRoutinesDetailDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly routinesApiService = inject(RoutinesApiService);
  private readonly toastr = inject(ToastrService);

  remove(routine: Routine): void {
    this.dialog
      .open(AskDialogComponent, {
        data: {
          message: `¿Eliminar la rutina ${routine.name}?`,
          title: 'Confirmar eliminación'
        }
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe(result => {
        if (!result) return;
        this.routinesApiService.remove(routine.id).pipe(take(1)).subscribe(() => {
          this.data.routines = this.data.routines.filter((r) => r.id !== routine.id);
          this.toastr.success('Rutina eliminada.');
        });
      });
  }
}
