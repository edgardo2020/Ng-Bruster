import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';

import { Routine, RoutineExercise } from '../../../../core/models/gym.models';

@Component({
  selector: 'app-my-routines-panel',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatDividerModule, MatIconModule, MatButtonModule],
  templateUrl: './my-routines-panel.component.html',
  styleUrl: './my-routines-panel.component.scss'
})
export class MyRoutinesPanelComponent {
  @Input({ required: true }) routines: Routine[] = [];

  readonly previewExercise = signal<RoutineExercise | null>(null);

  showImagePreview(exercise: RoutineExercise): void {
    //console.log('Mostrando imagen para ejercicio:', exercise);
    this.previewExercise.set(exercise);
  }

  closeImagePreview(): void {
    this.previewExercise.set(null);
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
