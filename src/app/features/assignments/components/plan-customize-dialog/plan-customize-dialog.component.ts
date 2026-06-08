import { DatePipe } from '@angular/common';
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
import { Observable, Subject, debounceTime, startWith, switchMap, take } from 'rxjs';
import { RoutinesApiService } from '../../../routines/data-access/routines-api.service';

import { ExerciseCatalogItem, MuscleGroupCatalogItem, Routine, RoutineExercise, TrainingPlan, TrainingPlanScheduleItem, UserRecord } from '../../../../core/models/gym.models';
import { NotificationService } from '../../../../core/services/notification.service';
import { MatDialog } from '@angular/material/dialog';
import { AskDialogComponent } from '../../../../shared/ui/ask-dialog.component';
import { AssignmentDetail } from '../../data-access/assignments-api.service';
import { AssignmentsStore } from '../../data-access/assignments.store';
import { StatCardComponent } from '../../../../shared/ui/stat-card.component';

interface PlanCustomizeAgendaItem {
  week: number;
  day: string;
  routineId?: string;
  exercises: AssignedExerciseItem[];
}

export interface AssignedExerciseItem extends ExerciseCatalogItem {
  assignedSets?: number;
  assignedReps?: number;
  assignedWeight?: number;
  isFinished?: boolean;
}

export interface PlanCustomizeDialogData {
  plans: TrainingPlan[];
  exercises: ExerciseCatalogItem[];
  muscleGroups: MuscleGroupCatalogItem[];
  users: UserRecord[];
  companyId?: number;
  lockedAssignment?: {
    userId: string;
    userName: string;
    startDate: string;
    planName: string;
  };
  editingAssignmentId?: number;
  initialDetail?: AssignmentDetail;
  initialFocus?: string;
  initialIntensity?: string;
  initialNotes?: string;
  initialWeeks?: number;
  initialAgenda?: PlanCustomizeAgendaItem[];
  focusOptions?: string[];
  intensityOptions?: string[];
}

export interface PlanCustomizeDialogResult {
  userId: string;
  startDate: string;
  focus: string;
  intensity: string;
  notes: string;
  durationWeeks: number;
  selectedAgenda: PlanCustomizeAgendaItem[];
}

@Component({
  selector: 'app-plan-customize-dialog',
  standalone: true,
  imports: [
    DatePipe,
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
    confirmClearRoutine(): void {
      this.matDialog.open(AskDialogComponent, {
        data: {
          title: 'Limpiar toda la rutina',
          message: '¿Seguro que quieres limpiar toda la rutina? Esta acción eliminará todos los ejercicios de todos los días y semanas.'
        }
      }).afterClosed().pipe(take(1)).subscribe((result: boolean) => {
        if (result) {
          this.clearRoutine();
        }
      });
    }

    clearRoutine(): void {
      const bySlot = { ...this.agendaBySlot() };
      Object.keys(bySlot).forEach(key => {
        bySlot[key] = [];
      });
      this.agendaBySlot.set(bySlot);
      // Opcional: sincronizar todos los slots
      this.weekNumbers().forEach(week => {
        this.days.forEach(day => this.syncSlotRoutine(week, day));
      });
    }
  private readonly matDialog = inject(MatDialog);

  confirmResetDay(week: number, day: string): void {
    this.matDialog.open(AskDialogComponent, {
      data: {
        title: 'Reiniciar día',
        message: '¿Seguro que quieres reiniciar todo el día? Esta acción marcará todos los ejercicios del día como no finalizados.'
      }
    }).afterClosed().pipe(take(1)).subscribe((result: boolean) => {
      if (result) {
        this.resetDay(week, day);
      }
    });
  }

        resetDay(week: number, day: string): void {
          const key = this.getSlotKey(week, day);
          const bySlot = { ...this.agendaBySlot() };
          const exercises = [...(bySlot[key] ?? [])];
          if (!exercises.length) return;
          bySlot[key] = exercises.map(ex => ({ ...ex, isFinished: false }));
          this.agendaBySlot.set(bySlot);
          this.syncSlotRoutine(week, day);
        }
      resetExerciseFinished(week: number, day: string, index: number): void {
        const key = this.getSlotKey(week, day);
        const bySlot = { ...this.agendaBySlot() };
        const exercises = [...(bySlot[key] ?? [])];
        if (!exercises[index]) return;
        exercises[index] = { ...exercises[index], isFinished: false };
        bySlot[key] = exercises;
        this.agendaBySlot.set(bySlot);
        this.syncSlotRoutine(week, day);
      }
    confirmClearDay(week: number, day: string): void {
      this.matDialog.open(AskDialogComponent, {
        data: {
          title: 'Limpiar día',
          message: '¿Seguro que quieres limpiar todo el día? Esta acción eliminará todos los ejercicios del día.'
        }
      }).afterClosed().pipe(take(1)).subscribe((result: boolean) => {
        if (result) {
          this.clearDay(week, day);
        }
      });
    }

    clearDay(week: number, day: string): void {
      const key = this.getSlotKey(week, day);
      const bySlot = { ...this.agendaBySlot() };
      if ((bySlot[key] ?? []).length === 0) return;
      bySlot[key] = [];
      this.agendaBySlot.set(bySlot);
      this.syncSlotRoutine(week, day);
    }
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<PlanCustomizeDialogComponent, PlanCustomizeDialogResult>);
  private readonly assignmentsStore = inject(AssignmentsStore);
  private readonly routinesApi = inject(RoutinesApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly detailSyncQueue$ = new Subject<void>();

  readonly data = inject<PlanCustomizeDialogData>(MAT_DIALOG_DATA);
  readonly lockedAssignment = this.data.lockedAssignment;
  readonly hasLockedAssignment = Boolean(this.lockedAssignment);
  readonly editingAssignmentId = this.data.editingAssignmentId;
  readonly usersRole2 = this.data.users.filter(
    (user) => user.idRol === 2 && (this.data.companyId == null || user.idEmpresa === this.data.companyId)
  );
  readonly days = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  readonly availableExercises = signal<ExerciseCatalogItem[]>([]);
  readonly selectedMuscleGroupId = signal<number | 'all'>('all');
  readonly focusOptions = this.data.focusOptions ?? ['Hipertrofia', 'Resistencia', 'Definicion', 'Fuerza funcional'];
  readonly intensityOptions = this.data.intensityOptions ?? ['Baja', 'Media', 'Alta'];
  readonly showDashboardCard = signal(true);
  readonly showExercisesPanel = signal(true);
  readonly durationWeeks = signal(1);
  readonly weekNumbers = computed(() => Array.from({ length: this.durationWeeks() }, (_, index) => index + 1));
  readonly agendaBySlot = signal<Record<string, AssignedExerciseItem[]>>({});
  readonly routineIdsBySlot = signal<Record<string, string | undefined>>({});
  private firstUserEmissionHandled = false;
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
    this.durationWeeks.set(this.resolveInitialWeeks());

    // Si es un plan customizado nuevo (no edición), ocultar cards al abrir
    if (!this.editingAssignmentId) {
      this.showDashboardCard.set(true);
      this.showExercisesPanel.set(false);
    }

    if (this.lockedAssignment) {
      this.form.patchValue({
        userId: this.lockedAssignment.userId,
        startDate: this.toIsoDate(this.lockedAssignment.startDate)
      });
      this.form.controls.userId.disable();
    }

    this.form.patchValue({
      focus: this.resolveInitialFocus(),
      intensity: this.resolveInitialIntensity(),
      notes: this.data.initialNotes ?? ''
    });

    this.form.controls.userId.valueChanges
      .pipe(startWith(this.form.controls.userId.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.resetBoard();

        if (!this.firstUserEmissionHandled) {
          this.applyInitialAgenda();
          this.firstUserEmissionHandled = true;
        }
      });

    this.detailSyncQueue$
      .pipe(
        debounceTime(150),
        switchMap(() => this.assignmentsStore.updateDetail(this.buildDetailPayload())),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        error: () => this.notificationService.error('No se pudo sincronizar el detalle de la asignacion personalizada.')
      });
  }

  close(): void {
    this.dialogRef.close();
  }

  get dialogTitle(): string {
    if (this.editingAssignmentId != null) {
      return `Plan personalizado ${this.getSelectedUserName()}`;
    }

    return 'Personalizar plan para usuarios';
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

    const selectedAgenda = this.weekNumbers().flatMap((week) =>
      this.days.map((day) => ({
        week,
        day,
        exercises: this.getExercisesForSlot(week, day).map((exercise) => ({
          ...exercise,
          isFinished: exercise.isFinished ?? false
        }))
      }))
    );
   // console.log('Selected Agenda:', selectedAgenda);
    this.dialogRef.close({
      ...this.form.getRawValue(),
      durationWeeks: this.durationWeeks(),
      selectedAgenda
    });
  }

  addWeek(): void {
    const currentWeeks = this.durationWeeks();
    if (currentWeeks >= 4) {
      return;
    }

    const nextWeek = currentWeeks + 1;
    this.durationWeeks.set(nextWeek);

    const bySlot = { ...this.agendaBySlot() };
    this.days.forEach((day) => {
      bySlot[this.getSlotKey(nextWeek, day)] = [];
    });
    this.agendaBySlot.set(bySlot);
  }

  removeWeek(): void {
    const currentWeeks = this.durationWeeks();
    if (currentWeeks <= 1) {
      return;
    }

    const bySlot = { ...this.agendaBySlot() };
    this.days.forEach((day) => {
      delete bySlot[this.getSlotKey(currentWeeks, day)];
    });

    this.agendaBySlot.set(bySlot);
    this.durationWeeks.set(currentWeeks - 1);
    this.queueDetailSync();
  }

  getSelectedUser(): UserRecord | undefined {
    const userId = this.form.controls.userId.value;
    return this.usersRole2.find((user) => String(user.id) === String(userId));
  }

  getSelectedUserName(): string {
    return this.getSelectedUser()?.nombre ?? this.lockedAssignment?.userName ?? 'Sin seleccionar';
  }

  getMetricValue(metric: 'user' | 'status' | 'days' | 'sessions'): string {
    const selectedUser = this.getSelectedUser();
    const totalAssigned = this.weekNumbers().reduce(
      (total, week) => total + this.days.reduce((weekTotal, day) => weekTotal + this.getExercisesForSlot(week, day).length, 0),
      0
    );
    const activeDays = this.weekNumbers().reduce(
      (total, week) => total + this.days.filter((day) => this.getExercisesForSlot(week, day).length > 0).length,
      0
    );

    switch (metric) {
      case 'user':
        return selectedUser?.nombre ?? this.lockedAssignment?.userName ?? 'Sin seleccionar';
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

  getAgendaExercises(): AssignedExerciseItem[] {
    return this.weekNumbers().flatMap((week) => this.days.flatMap((day) => this.getExercisesForSlot(week, day)));
  }

  getExercisesForSlot(week: number, day: string): AssignedExerciseItem[] {
    return this.agendaBySlot()[this.getSlotKey(week, day)] ?? [];
  }

  getConnectedDropLists(week: number, day: string): string[] {
    const currentId = this.getDayDropListId(week, day);
    return ['availableExercisesList', ...this.getAllDayDropListIds().filter((entry) => entry !== currentId)];
  }

  getAllDayDropListIds(): string[] {
    return this.weekNumbers().flatMap((week) => this.days.map((day) => this.getDayDropListId(week, day)));
  }

  getDayDropListId(week: number, day: string): string {
    return `agendaWeek-${week}-${day.toLowerCase()}`;
  }

  removeExerciseFromDay(week: number, day: string, index: number): void {
    const key = this.getSlotKey(week, day);
    const bySlot = { ...this.agendaBySlot() };
    const exercises = [...(bySlot[key] ?? [])];

    if (index < 0 || index >= exercises.length) {
      return;
    }

    exercises.splice(index, 1);
    bySlot[key] = exercises;
    this.agendaBySlot.set(bySlot);
    this.syncSlotRoutine(week, day);
  }

  dropExercise(event: CdkDragDrop<AssignedExerciseItem[]>, targetWeek?: number, targetDay?: string): void {
    if (event.container.id === 'availableExercisesList') {
      this.dropToAvailable(event);
      return;
    }

    if (!targetWeek || !targetDay) {
      return;
    }

    this.dropToDay(event, targetWeek, targetDay);
  }

  private dropToAvailable(event: CdkDragDrop<AssignedExerciseItem[]>): void {
    const sourcePosition = this.getPositionByDropListId(event.previousContainer.id);
    if (!sourcePosition) {
      return;
    }

    const sourceKey = this.getSlotKey(sourcePosition.week, sourcePosition.day);
    const bySlot = { ...this.agendaBySlot() };
    const source = [...(bySlot[sourceKey] ?? [])];
    source.splice(event.previousIndex, 1);
    bySlot[sourceKey] = source;
    this.agendaBySlot.set(bySlot);

    this.syncSlotRoutine(sourcePosition.week, sourcePosition.day);
  }

  private dropToDay(event: CdkDragDrop<AssignedExerciseItem[]>, targetWeek: number, targetDay: string): void {
    const targetKey = this.getSlotKey(targetWeek, targetDay);
    const bySlot = { ...this.agendaBySlot() };
    const target = [...(bySlot[targetKey] ?? [])];

    if (event.previousContainer === event.container) {
      moveItemInArray(target, event.previousIndex, event.currentIndex);
      bySlot[targetKey] = target;
      this.agendaBySlot.set(bySlot);
      this.syncSlotRoutine(targetWeek, targetDay);
      return;
    }

    if (event.previousContainer.id === 'availableExercisesList') {
      const draggedExercise = event.item.data as ExerciseCatalogItem | undefined;
      console.log(draggedExercise)
      if (!draggedExercise) {
        return;
      }

      if (this.hasLockedAssignment && this.containsExercise(target, draggedExercise.id)) {
        this.notificationService.info('Ese ejercicio ya esta agregado en el dia seleccionado.');
        return;
      }

      target.splice(event.currentIndex, 0, this.toAssignedExercise(draggedExercise));
      bySlot[targetKey] = target;
      this.agendaBySlot.set(bySlot);
      this.syncSlotRoutine(targetWeek, targetDay);
      return;
    }

    const sourcePosition = this.getPositionByDropListId(event.previousContainer.id);
    if (!sourcePosition) {
      return;
    }

    const sourceKey = this.getSlotKey(sourcePosition.week, sourcePosition.day);
    const source = [...(bySlot[sourceKey] ?? [])];
    const movedExercise = source[event.previousIndex];
    if (!movedExercise) {
      return;
    }

    if (this.hasLockedAssignment && this.containsExercise(target, movedExercise.id)) {
      this.notificationService.info('Ese ejercicio ya esta agregado en el dia seleccionado.');
      return;
    }

    transferArrayItem(source, target, event.previousIndex, event.currentIndex);
    bySlot[sourceKey] = source;
    bySlot[targetKey] = target;
    this.agendaBySlot.set(bySlot);
    this.syncSlotRoutine(sourcePosition.week, sourcePosition.day);
    this.syncSlotRoutine(targetWeek, targetDay);
  }

  private containsExercise(dayExercises: AssignedExerciseItem[], exerciseId: string): boolean {
    return dayExercises.some((exercise) => exercise.id === exerciseId);
  }

  updateExerciseReps(week: number, day: string, index: number, value: string): void {
    const nextValue = this.toPositiveInt(value, 1);
    this.updateExerciseField(week, day, index, { assignedReps: nextValue });
  }

  updateExerciseWeight(week: number, day: string, index: number, value: string): void {
    const nextValue = this.toPositiveNumber(value, 0);
    this.updateExerciseField(week, day, index, { assignedWeight: nextValue });
  }

  updateExerciseSets(week: number, day: string, index: number, value: string): void {
    const nextValue = this.toPositiveInt(value, 1);
    this.updateExerciseField(week, day, index, { assignedSets: nextValue });
  }

  private queueDetailSync(): void {
    if (!this.hasLockedAssignment || this.editingAssignmentId == null) {
      return;
    }

    this.detailSyncQueue$.next();
  }

  private syncSlotRoutine(week: number, day: string): void {
    if (!this.hasLockedAssignment || this.editingAssignmentId == null) {
      return;
    }

    const key = this.getSlotKey(week, day);
    console.log(`Sincronizando rutina del ${day} semana ${week}...`);
    const exercises = this.getExercisesForSlot(week, day);
    const existingRoutineId = this.routineIdsBySlot()[key];
    const isCreatingRoutine = !existingRoutineId;
    const planId = this.data.initialDetail?.planId;
    const userName = this.getSelectedUserName();
    console.log('id de rutina existente:', existingRoutineId);
    const routineExercises: RoutineExercise[] = exercises.map((ex) => ({
      id: '',
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: ex.assignedSets ?? 3,
      reps: ex.assignedReps ?? 10,
      weight: ex.assignedWeight ?? 0,
      isFinished: ex.isFinished ?? false

    }));

    const routinePayload: Routine = {
      id: existingRoutineId ?? '0',
      name: `RUTINA PERSONALIZADA ${userName} Semana ${week} - ${day}`,
      description: isCreatingRoutine
        ? `Rutina generada para ${userName} - ${day} semana ${week}`
        : `Rutina del plan personalizado - ${day} semana ${week}`,
      isCustomized: isCreatingRoutine ? true : undefined,
      planId: isCreatingRoutine ? planId : undefined,
      week,
      day,
      exercises: routineExercises
    };

    const request$: Observable<Routine> = existingRoutineId
      ? this.routinesApi.update(routinePayload)
      : this.routinesApi.create(routinePayload);

    request$.pipe(take(1)).subscribe({
      next: (result) => {
        if (!existingRoutineId && result?.id) {
          this.routineIdsBySlot.update((prev) => ({ ...prev, [key]: result.id }));
        }
      },
      error: () => this.notificationService.error(`No se pudo sincronizar la rutina del ${day} semana ${week}.`)
    });
  }

  private buildDetailPayload(): AssignmentDetail {
    const baseDetail = this.data.initialDetail;
    const rawValue = this.form.getRawValue();

    return {
      id: this.editingAssignmentId ?? baseDetail?.id ?? 0,
      userId: rawValue.userId,
      userName: this.getSelectedUserName(),
      planId: baseDetail?.planId ?? '',
      planName: this.lockedAssignment?.planName ?? baseDetail?.planName ?? '',
      startDate: new Date(rawValue.startDate).toISOString(),
      durationWeeks: this.durationWeeks(),
      isCustomized: true,
      focus: rawValue.focus,
      intensity: rawValue.intensity,
      notes: rawValue.notes,
      agenda: this.weekNumbers().flatMap((week) =>
        this.days.map((day) => ({
          week,
          day,
          exercises: this.getExercisesForSlot(week, day).map((exercise) => ({
            ...exercise,
            isFinished: exercise.isFinished ?? false
          }))
        }))
      )
    };
  }

  private getPositionByDropListId(dropListId: string): { week: number; day: string } | null {
    if (!dropListId.startsWith('agendaWeek-')) {
      return null;
    }

    const parts = dropListId.replace('agendaWeek-', '').split('-');
    const parsedWeek = Number(parts.shift());
    const normalizedDay = parts.join('-').toLowerCase();

    if (!Number.isFinite(parsedWeek)) {
      return null;
    }

    const day = this.days.find((entry) => entry.toLowerCase() === normalizedDay);
    if (!day) {
      return null;
    }

    return { week: parsedWeek, day };
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

  private toIsoDate(value: string): string {
    return new Date(value).toISOString().slice(0, 10);
  }

  private resolveInitialFocus(): string {
    const initialFocus = this.data.initialFocus;

    if (initialFocus && this.focusOptions.includes(initialFocus)) {
      return initialFocus;
    }

    return this.focusOptions[0];
  }

  private resolveInitialIntensity(): string {
    const initialIntensity = this.data.initialIntensity;

    if (initialIntensity && this.intensityOptions.includes(initialIntensity)) {
      return initialIntensity;
    }

    return this.intensityOptions[1] ?? this.intensityOptions[0];
  }

  private resolveInitialWeeks(): number {
    const requestedWeeks = Number(this.data.initialWeeks ?? this.data.initialDetail?.durationWeeks ?? 1);
    const safeRequestedWeeks = Number.isFinite(requestedWeeks) ? Math.floor(requestedWeeks) : 1;

    const maxAgendaWeekWithExercises = Array.isArray(this.data.initialAgenda)
      ? this.data.initialAgenda.reduce((maxWeek, entry) => {
          const entryWeek = Number(entry.week);
          if (!Number.isFinite(entryWeek) || !Array.isArray(entry.exercises) || entry.exercises.length === 0) {
            return maxWeek;
          }

          return Math.max(maxWeek, Math.floor(entryWeek));
        }, 1)
      : 1;

    const resolvedWeeks = Math.max(safeRequestedWeeks, maxAgendaWeekWithExercises, 1);
    return Math.min(resolvedWeeks, 4);
  }

  private resetBoard(): void {
    this.selectedMuscleGroupId.set('all');
    this.availableExercises.set([...this.data.exercises]);
    this.agendaBySlot.set(this.createEmptyAgendaBySlot(this.durationWeeks()));
  }

  private applyInitialAgenda(): void {
    if (!Array.isArray(this.data.initialAgenda) || !this.data.initialAgenda.length) {
      return;
    }

    const nextAgendaBySlot = this.createEmptyAgendaBySlot(this.durationWeeks());
    const nextRoutineIds: Record<string, string | undefined> = {};
    console.log('Applying initial agenda:', this.data.initialAgenda);
    this.data.initialAgenda.forEach((entry) => {
      const normalizedDay = this.normalizeDay(entry.day);
      if (!normalizedDay) {
        return;
      }

      const week = Number.isFinite(Number(entry.week)) ? Math.max(1, Math.min(4, Math.floor(Number(entry.week)))) : 1;
      const key = this.getSlotKey(week, normalizedDay);
      nextAgendaBySlot[key] = Array.isArray(entry.exercises) ? entry.exercises.map((exercise) => this.toAssignedExercise(exercise)) : [];

      if (entry.routineId) {
        nextRoutineIds[key] = String(entry.routineId);
      }
    });

    this.agendaBySlot.set(nextAgendaBySlot);
    this.routineIdsBySlot.set(nextRoutineIds);

    // En modo edicion se debe mostrar el catalogo completo de ejercicios disponibles.
    this.availableExercises.set([...this.data.exercises]);
  }

  private normalizeDay(day: string): string | null {
    const normalizedInput = this.normalizeText(day);
    return this.days.find((entry) => this.normalizeText(entry) === normalizedInput) ?? null;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private updateExerciseField(
    week: number,
    day: string,
    index: number,
    patch: Partial<Pick<AssignedExerciseItem, 'assignedSets' | 'assignedReps' | 'assignedWeight'>>
  ): void {
    const key = this.getSlotKey(week, day);
    const bySlot = { ...this.agendaBySlot() };
    const exercises = [...(bySlot[key] ?? [])];
    const target = exercises[index];

    if (!target) {
      return;
    }

    exercises[index] = {
      ...target,
      ...patch
    };

    bySlot[key] = exercises;
    this.agendaBySlot.set(bySlot);
    this.syncSlotRoutine(week, day);
  }

  private toAssignedExercise(exercise: ExerciseCatalogItem): AssignedExerciseItem {
    const defaults = this.getIntensityDefaults(this.form.controls.intensity.value);
    const assignedExercise = exercise as AssignedExerciseItem;

    return {
      ...exercise,
      assignedSets: assignedExercise.assignedSets ?? defaults.sets,
      assignedReps: assignedExercise.assignedReps ?? defaults.reps,
      assignedWeight: assignedExercise.assignedWeight ?? defaults.weight
    };
  }

  private getIntensityDefaults(intensity: string): { sets: number; reps: number; weight: number } {
    const defaultsByIntensity: Record<string, { sets: number; reps: number; weight: number }> = {
      Baja: { sets: 3, reps: 12, weight: 15 },
      Media: { sets: 3, reps: 10, weight: 20 },
      Alta: { sets: 4, reps: 8, weight: 25 }
    };

    return defaultsByIntensity[intensity] ?? defaultsByIntensity['Media'];
  }

  private toPositiveInt(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private toPositiveNumber(value: string, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private getSlotKey(week: number, day: string): string {
    return `${week}-${day}`;
  }

  private createEmptyAgendaBySlot(totalWeeks: number): Record<string, AssignedExerciseItem[]> {
    const next: Record<string, AssignedExerciseItem[]> = {};
    for (let week = 1; week <= totalWeeks; week++) {
      this.days.forEach((day) => {
        next[this.getSlotKey(week, day)] = [];
      });
    }

    return next;
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
