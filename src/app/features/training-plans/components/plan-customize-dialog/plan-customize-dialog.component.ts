import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { startWith } from 'rxjs';

import { ExerciseCatalogItem, MuscleGroupCatalogItem, TrainingPlan, TrainingPlanScheduleItem, UserRecord } from '../../../../core/models/gym.models';
import { StatCardComponent } from '../../../../shared/ui/stat-card.component';

export interface PlanCustomizeDialogData {
  plans: TrainingPlan[];
  exercises: ExerciseCatalogItem[];
  muscleGroups: MuscleGroupCatalogItem[];
  users: UserRecord[];
  companyId?: number;
  focusOptions?: string[];
  intensityOptions?: string[];
}

export interface PlanCustomizeDialogResult {
  userId: string;
  startDate: string;
  focus: string;
  intensity: string;
  notes: string;
}

@Component({
  selector: 'app-plan-customize-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DragDropModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    StatCardComponent
  ],
  templateUrl: './plan-customize-dialog.component.html',
  styleUrl: './plan-customize-dialog.component.scss'
})
export class PlanCustomizeDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<PlanCustomizeDialogComponent, PlanCustomizeDialogResult>);

  readonly data = inject<PlanCustomizeDialogData>(MAT_DIALOG_DATA);
  readonly usersRole2 = this.data.users.filter(
    (user) => user.idRol === 2 && (this.data.companyId == null || user.idEmpresa === this.data.companyId)
  );
  readonly days = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  readonly availableExercises = signal<ExerciseCatalogItem[]>([]);
  readonly selectedMuscleGroupId = signal<number | 'all'>('all');
  readonly agendaByDay = signal<Record<string, ExerciseCatalogItem[]>>(
    this.days.reduce<Record<string, ExerciseCatalogItem[]>>((acc, day) => {
      acc[day] = [];
      return acc;
    }, {})
  );
  readonly focusOptions = this.data.focusOptions ?? ['Hipertrofia', 'Resistencia', 'Definicion', 'Fuerza funcional'];
  readonly intensityOptions = this.data.intensityOptions ?? ['Baja', 'Media', 'Alta'];
  readonly muscleGroupOptions = computed(() =>
    [...this.data.muscleGroups].sort((left, right) => left.description.localeCompare(right.description))
  );
  readonly filteredAvailableExercises = computed(() => {
    const muscleGroupId = this.selectedMuscleGroupId();
    const exercises = this.availableExercises();

    if (muscleGroupId === 'all') {
      return exercises;
    }

    return exercises.filter((exercise) => this.getExerciseMuscleGroupId(exercise) === muscleGroupId);
  });

  readonly form = this.formBuilder.nonNullable.group({
    userId: ['', Validators.required],
    startDate: [this.todayIsoDate(), Validators.required],
    focus: [this.focusOptions[0], Validators.required],
    intensity: [this.intensityOptions[1] ?? this.intensityOptions[0], Validators.required],
    notes: ['']
  });

  constructor() {
    this.form.controls.userId.valueChanges
      .pipe(startWith(this.form.controls.userId.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Reinicia el tablero cuando cambia el usuario para iniciar una personalizacion limpia.
        this.selectedMuscleGroupId.set('all');
        this.availableExercises.set([...this.data.exercises]);
        this.agendaByDay.set(
          this.days.reduce<Record<string, ExerciseCatalogItem[]>>((acc, day) => {
            acc[day] = [];
            return acc;
          }, {})
        );
      });
  }

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close(this.form.getRawValue());
  }

  getSelectedUser(): UserRecord | undefined {
    const userId = this.form.controls.userId.value;
    return this.usersRole2.find((user) => String(user.id) === String(userId));
  }

  getMetricValue(metric: 'user' | 'status' | 'days' | 'sessions'): string {
    const selectedUser = this.getSelectedUser();
    const totalAssigned = this.days.reduce((total, day) => total + this.getExercisesForDay(day).length, 0);
    const activeDays = this.days.filter((day) => this.getExercisesForDay(day).length > 0).length;

    switch (metric) {
      case 'user':
        return selectedUser?.nombre ?? 'Sin seleccionar';
      case 'status':
        return this.getUserStatusLabel();
      case 'days':
        return String(activeDays);
      case 'sessions':
        return String(totalAssigned);
    }
  }

  getAvailableExercises(): ExerciseCatalogItem[] {
    return this.filteredAvailableExercises();
  }

  setSelectedMuscleGroup(muscleGroupId: number | string | 'all'): void {
    if (muscleGroupId === 'all') {
      this.selectedMuscleGroupId.set('all');
      return;
    }

    this.selectedMuscleGroupId.set(Number(muscleGroupId));
  }

  getAgendaExercises(): ExerciseCatalogItem[] {
    return this.days.flatMap((day) => this.getExercisesForDay(day));
  }

  getExercisesForDay(day: string): ExerciseCatalogItem[] {
    return this.agendaByDay()[day] ?? [];
  }

  getConnectedDropLists(day: string): string[] {
    return ['availableExercisesList', ...this.days.filter((entry) => entry !== day).map((entry) => this.getDayDropListId(entry))];
  }

  getAllDayDropListIds(): string[] {
    return this.days.map((day) => this.getDayDropListId(day));
  }

  getDayDropListId(day: string): string {
    return `agendaDay-${day.toLowerCase()}`;
  }

  dropExercise(event: CdkDragDrop<ExerciseCatalogItem[]>, targetDay?: string): void {
    if (event.container.id === 'availableExercisesList') {
      this.dropToAvailable(event);
      return;
    }

    if (!targetDay) {
      return;
    }

    this.dropToDay(event, targetDay);
  }

  private dropToAvailable(event: CdkDragDrop<ExerciseCatalogItem[]>): void {
    const sourceDay = this.getDayByDropListId(event.previousContainer.id);
    if (!sourceDay) {
      return;
    }

    const byDay = { ...this.agendaByDay() };
    const source = [...(byDay[sourceDay] ?? [])];
    source.splice(event.previousIndex, 1);
    byDay[sourceDay] = source;

    this.agendaByDay.set(byDay);
  }

  private dropToDay(event: CdkDragDrop<ExerciseCatalogItem[]>, targetDay: string): void {
    const byDay = { ...this.agendaByDay() };
    const target = [...(byDay[targetDay] ?? [])];

    if (event.previousContainer === event.container) {
      moveItemInArray(target, event.previousIndex, event.currentIndex);
      byDay[targetDay] = target;
      this.agendaByDay.set(byDay);
      return;
    }

    if (event.previousContainer.id === 'availableExercisesList') {
      const draggedExercise = event.item.data as ExerciseCatalogItem | undefined;
      if (!draggedExercise) {
        return;
      }

      target.splice(event.currentIndex, 0, { ...draggedExercise });
      byDay[targetDay] = target;
      this.agendaByDay.set(byDay);
      return;
    }

    const sourceDay = this.getDayByDropListId(event.previousContainer.id);
    if (!sourceDay) {
      return;
    }

    const source = [...(byDay[sourceDay] ?? [])];
    transferArrayItem(source, target, event.previousIndex, event.currentIndex);
    byDay[sourceDay] = source;
    byDay[targetDay] = target;
    this.agendaByDay.set(byDay);
  }

  private getDayByDropListId(dropListId: string): string | null {
    if (!dropListId.startsWith('agendaDay-')) {
      return null;
    }

    const normalized = dropListId.replace('agendaDay-', '').toLowerCase();
    return this.days.find((day) => day.toLowerCase() === normalized) ?? null;
  }

  getUserStatusLabel(): string {
    const user = this.getSelectedUser();
    if (!user) {
      return 'Pendiente de seleccion';
    }

    return user.active ? 'Activo' : 'Inactivo';
  }

  private todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getExerciseMuscleGroupId(exercise: ExerciseCatalogItem): number | null {
    if (typeof exercise.muscleGroupCatalogId === 'number') {
      return exercise.muscleGroupCatalogId;
    }

    if (typeof exercise.muscleGroupCatalog?.id === 'number') {
      return exercise.muscleGroupCatalog.id;
    }

    if (exercise.muscleGroupCatalog?.id != null) {
      return Number(exercise.muscleGroupCatalog.id);
    }

    return null;
  }
}
