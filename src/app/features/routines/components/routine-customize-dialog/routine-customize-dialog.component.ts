import { Component, computed, inject, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { ExerciseCatalogItem, RoutineExercise, UserRecord } from '../../../../core/models/gym.models';
import { StatCardComponent } from '../../../../shared/ui/stat-card.component';

export interface RoutineCustomizeDialogData {
  users: UserRecord[];
  exercises: ExerciseCatalogItem[];
  focusOptions?: string[];
  intensityOptions?: string[];
}

export interface RoutineCustomizeDialogResult {
  userId: string;
  routineName: string;
  focus: string;
  intensity: string;
  notes: string;
  selectedExercises: RoutineExercise[];
}

@Component({
  selector: 'app-routine-customize-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DragDropModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    StatCardComponent
  ],
  templateUrl: './routine-customize-dialog.component.html',
  styleUrl: './routine-customize-dialog.component.scss'
})
export class RoutineCustomizeDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<RoutineCustomizeDialogComponent, RoutineCustomizeDialogResult>);

  readonly data = inject<RoutineCustomizeDialogData>(MAT_DIALOG_DATA);
  readonly users = this.data.users.filter((user) => user.idRol === 2);
  readonly focusOptions = this.data.focusOptions ?? ['Hipertrofia', 'Resistencia', 'Definicion', 'Fuerza funcional'];
  readonly intensityOptions = this.data.intensityOptions ?? ['Baja', 'Media', 'Alta'];
  readonly selectedExercises = signal<RoutineExercise[]>([]);
  readonly showDashboardCard = signal(true);
  readonly showExercisesPanel = signal(true);
  readonly selectedMuscleGroup = signal<string>('all');
  readonly muscleGroupOptions = computed(() => {
    const uniqueGroups = new Set(
      this.data.exercises
        .map((exercise) => this.getExerciseGroupLabel(exercise))
        .filter((group): group is string => Boolean(group))
    );

    return Array.from(uniqueGroups).sort((a, b) => a.localeCompare(b));
  });
  readonly panelAvailableExercises = computed(() => {
    const selectedIds = new Set(this.selectedExercises().map((exercise) => exercise.exerciseId));
    const groupFilter = this.selectedMuscleGroup();

    return this.data.exercises
      .filter((exercise) => !selectedIds.has(exercise.id))
      .filter((exercise) => {
        if (groupFilter === 'all') {
          return true;
        }

        return this.getExerciseGroupLabel(exercise) === groupFilter;
      })
      .map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: 4,
        reps: 10,
        weight: 20
      }));
  });

  readonly form = this.formBuilder.nonNullable.group({
    userId: ['', Validators.required],
    routineName: ['', [Validators.required, Validators.minLength(4)]],
    focus: [this.focusOptions[0], Validators.required],
    intensity: [this.intensityOptions[1] ?? this.intensityOptions[0], Validators.required],
    notes: ['']
  });

  close(): void {
    this.dialogRef.close();
  }

  toggleDashboardCard(): void {
    this.showDashboardCard.update((visible) => !visible);
  }

  toggleExercisesPanel(): void {
    this.showExercisesPanel.update((visible) => !visible);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.selectedExercises().length) {
      return;
    }

    this.dialogRef.close({
      ...this.form.getRawValue(),
      selectedExercises: [...this.selectedExercises()]
    });
  }

  applySuggestedName(): void {
    const user = this.getSelectedUser();
    if (!user) {
      return;
    }

    const currentName = this.form.controls.routineName.value.trim();
    if (currentName.length > 0) {
      return;
    }

    this.form.controls.routineName.setValue(`RUTINA PERSONALIZADA ${user.nombre}`);
  }

  getSelectedUser(): UserRecord | undefined {
    const userId = this.form.controls.userId.value;
    return this.users.find((user) => String(user.id) === String(userId));
  }

  dropExercise(event: CdkDragDrop<RoutineExercise[]>): void {
    if (event.container.id === 'routineBoardList') {
      if (event.previousContainer.id === 'availableExercisesList') {
        const current = [...this.selectedExercises()];
        const dragged = event.item.data as RoutineExercise | undefined;
        if (!dragged) {
          return;
        }

        const alreadyAdded = current.some((exercise) => exercise.exerciseId === dragged.exerciseId);
        if (alreadyAdded) {
          return;
        }

        current.splice(event.currentIndex, 0, { ...dragged, id: crypto.randomUUID() });
        this.selectedExercises.set(current);
        return;
      }

      const reordered = [...this.selectedExercises()];
      moveItemInArray(reordered, event.previousIndex, event.currentIndex);
      this.selectedExercises.set(reordered);
      return;
    }

    if (event.container.id === 'availableExercisesList' && event.previousContainer.id === 'routineBoardList') {
      const current = [...this.selectedExercises()];
      current.splice(event.previousIndex, 1);
      this.selectedExercises.set(current);
    }
  }

  removeExercise(index: number): void {
    const current = [...this.selectedExercises()];
    current.splice(index, 1);
    this.selectedExercises.set(current);
  }

  updateExerciseSets(index: number, value: string): void {
    this.updateExerciseMetric(index, 'sets', value, 1);
  }

  updateExerciseReps(index: number, value: string): void {
    this.updateExerciseMetric(index, 'reps', value, 1);
  }

  updateExerciseWeight(index: number, value: string): void {
    this.updateExerciseMetric(index, 'weight', value, 0);
  }

  getExerciseDescription(exerciseId: string): string {
    const description = this.data.exercises.find((exercise) => exercise.id === exerciseId)?.description;
    return description?.trim() || 'Sin descripcion';
  }

  setSelectedMuscleGroup(group: string): void {
    this.selectedMuscleGroup.set(group || 'all');
  }

  private updateExerciseMetric(index: number, metric: 'sets' | 'reps' | 'weight', value: string, min: number): void {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? Math.max(min, parsed) : min;

    this.selectedExercises.update((current) =>
      current.map((exercise, currentIndex) =>
        currentIndex === index
          ? {
              ...exercise,
              [metric]: safeValue
            }
          : exercise
      )
    );
  }

  private getExerciseGroupLabel(exercise: ExerciseCatalogItem): string {
    const catalogGroup = exercise.muscleGroupCatalog?.description?.trim();
    if (catalogGroup) {
      return catalogGroup;
    }

    return String(exercise.muscleGroup ?? '').trim();
  }

  getMetricValue(metric: 'user' | 'status' | 'focus' | 'exercises'): string {
    const user = this.getSelectedUser();

    switch (metric) {
      case 'user':
        return user?.nombre ?? 'Sin seleccionar';
      case 'status':
        return user ? (user.active ? 'Activo' : 'Inactivo') : 'Pendiente';
      case 'focus':
        return this.form.controls.focus.value;
      case 'exercises':
        return String(this.selectedExercises().length);
    }
  }
}
