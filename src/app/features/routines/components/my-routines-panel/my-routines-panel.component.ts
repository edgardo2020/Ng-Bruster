import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { Routine, RoutineExercise } from '../../../../core/models/gym.models';

@Component({
  selector: 'app-my-routines-panel',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './my-routines-panel.component.html',
  styleUrl: './my-routines-panel.component.scss'
})
export class MyRoutinesPanelComponent {
  @Input({ required: true }) routines: Routine[] = [];

  readonly previewExercise = signal<RoutineExercise | null>(null);
  readonly descriptionDialog = signal<RoutineExercise | null>(null);

  showImagePreview(exercise: RoutineExercise): void {
    this.previewExercise.set(exercise);
  }

  closeImagePreview(): void {
    this.previewExercise.set(null);
  }

  openDescriptionDialog(exercise: RoutineExercise): void {
    this.descriptionDialog.set(exercise);
  }

  closeDescriptionDialog(): void {
    this.descriptionDialog.set(null);
  }

  getTotalSets(routine: Routine): number {
    return routine.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  }

  getAverageWeight(routine: Routine): number {
    if (!routine.exercises.length) {
      return 0;
    }

    const totalWeight = routine.exercises.reduce((sum, exercise) => sum + exercise.weight, 0);
    return Math.round(totalWeight / routine.exercises.length);
  }
}
