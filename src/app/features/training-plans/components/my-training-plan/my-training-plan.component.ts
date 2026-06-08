import { CommonModule, DatePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  Input,
  QueryList,
  ViewChildren,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, startWith, take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AssignmentDetail,
  AssignmentDetailExercise,
} from '../../../assignments/data-access/assignments-api.service';
import { Routine, RoutineExercise } from '../../../../core/models/gym.models';
import { ToastrService } from 'ngx-toastr';
import { RoutinesApiService } from '../../../routines/data-access/routines-api.service';
import { RoutinesStore } from '../../../routines/data-access/routines.store';
import { ProgressCardComponent } from '../progress-card/progress-card.component';

@Component({
  selector: 'app-my-training-plan',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatTooltipModule,
    ProgressCardComponent
  ],
  templateUrl: './my-training-plan.component.html',
  styleUrls: ['./my-training-plan.component.scss'],
})
export class MyTrainingPlanComponent {
  // Estado para expandir/comprimir cards de rutina finalizada
  public readonly collapsedCards = signal<Record<string, boolean>>({});

  readonly previewExercise = signal<AssignmentDetailExercise | null>(null);

  showImagePreview(exercise: AssignmentDetailExercise): void {
    this.previewExercise.set(exercise);
  }

  closeImagePreview(): void {
    this.previewExercise.set(null);
  }

  // Devuelve true si todos los ejercicios de la agenda están finalizados
  public isAgendaItemFinished(item: { exercises: AssignmentDetailExercise[] }): boolean {
    return (item.exercises ?? []).length > 0 && (item.exercises ?? []).every(ex => !!ex.isFinished);
  }



  public irARutina() {
    const renderedItems = this.exerciseItems?.toArray() ?? [];
    console.log('Ejercicios renderizados:', renderedItems.length);
    if (!renderedItems.length) {
      this.toastr.info('No hay ejercicios para mostrar.');
      return;
    }
    // Buscar el primer ejercicio que NO esté finalizado
    const firstUnfinishedItem = renderedItems.find(
      (item) => item.nativeElement.dataset['finished'] !== 'true'
    );
    if (firstUnfinishedItem) {
      firstUnfinishedItem.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }
    this.toastr.info('¡Ya completaste todos los ejercicios!');
  }

  // Alterna el estado de comprimido/expandido para una card
  public toggleCardCollapse(routineId: any): void {
    const prev = this.collapsedCards();
    const current = prev[routineId];
    // Si es undefined (primer clic), lo consideramos colapsado y lo expandimos
    this.collapsedCards.set({ ...prev, [routineId]: current === undefined ? false : !current });
  }
  private readonly routinesApiService = inject(RoutinesApiService);
  readonly store = inject(RoutinesStore);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);
  private hasAutoScrolledToFinished = false;

  @ViewChildren('exerciseItem') private readonly exerciseItems?: QueryList<
    ElementRef<HTMLElement>
  >;

  private readonly detailsState = signal<AssignmentDetail[]>([]);
  public readonly routinesState = signal<Routine[]>([]);
  readonly updatingExerciseKeys = signal<string[]>([]);
  readonly dasharray = 2 * Math.PI * 18;
  
  //[attr.stroke-dashoffset]="(2 * Math.PI * 18) * (1 - (generalStats?.completedRoutines / (totalRoutines || 1)))"// Circunferencia de un círculo con radio 18 (para el gráfico de progreso)
  readonly dashoffset = (1 - (this.generalStats?.completedRoutines / (10))) * this.dasharray;
  @Input({ required: true })
  set details(value: AssignmentDetail[]) {
    const nextDetails = this.cloneDetails(value ?? []);
    this.detailsState.set(nextDetails);
    this.hasAutoScrolledToFinished = false;

    const userId = nextDetails[0]?.userId;
    if (!userId) {
      this.routinesState.set([]);
      return;
    }

    this.routinesApiService
      .getByUser(userId)
      .pipe(take(1))
      .subscribe((routines) =>
        this.routinesState.set(
          Array.isArray(routines)
            ? routines.map((routine) => ({ ...routine }))
            : [],
        ),
      );

    // Verificar si el plan está completado
    setTimeout(() => this.checkIfPlanCompleted(), 0);
  }

  get details(): AssignmentDetail[] {
    return this.detailsState();
  }

  private readonly defaultsByIntensity: Record<
    string,
    { sets: number; reps: number; weight: number }
  > = {
    Baja: { sets: 3, reps: 12, weight: 15 },
    Media: { sets: 3, reps: 10, weight: 20 },
    Alta: { sets: 4, reps: 8, weight: 25 },
  };

  ngAfterViewInit(): void {
    this.exerciseItems?.changes
      .pipe(startWith(this.exerciseItems), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.scrollToLastFinishedExercise());
  }

  get latestDetail(): AssignmentDetail | null {
    if (!this.detailsState().length) {
      return null;
    }

    return (
      [...this.detailsState()].sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      )[0] ?? null
    );
  }

  getAgendaLabel(week?: number, day?: string): string {
    const resolvedWeek = Number.isFinite(Number(week)) ? Number(week) : 1;
    const resolvedDay = day?.trim() || 'Dia programado';
    return `Semana ${resolvedWeek} - ${resolvedDay}`;
  }

  getEffectiveWeeks(detail: AssignmentDetail): number {
    const weeksWithExercises = this.getAgendaWithExercises(detail)
      .map((item) => Number(item.week))
      .filter((week) => Number.isFinite(week));

    if (weeksWithExercises.length > 0) {
      return Math.max(...weeksWithExercises);
    }

    return detail.durationWeeks ?? 0;
  }

  getAssignedSets(
    exercise: AssignmentDetailExercise,
    intensity?: string,
  ): number {
    console.log('Exercise:', exercise);
    console.log('Intensity:', intensity);
    return exercise.assignedSets ?? this.getDefaults(intensity).sets;
  }

  getAssignedReps(
    exercise: AssignmentDetailExercise,
    intensity?: string,
  ): number {
    return exercise.assignedReps ?? this.getDefaults(intensity).reps;
  }

  getAssignedWeight(
    exercise: AssignmentDetailExercise,
    intensity?: string,
  ): number {
    return exercise.assignedWeight ?? this.getDefaults(intensity).weight;
  }

  getAgendaWithExercises(detail: AssignmentDetail) {
    return (detail.agenda ?? []).filter(
      (item) => (item.exercises?.length ?? 0) > 0,
    );
  }

  isExerciseFinished(exercise: AssignmentDetailExercise): boolean {
    return Boolean(exercise.isFinished);
  }

  isUpdatingExercise(exerciseKey: string): boolean {
    return this.updatingExerciseKeys().includes(exerciseKey);
  }

  markExerciseFinished(routine: any, exercise: any): void {
    // 1. Actualizar la vista localmente (AssignmentDetail.agenda)
    const details = this.detailsState();
    let updated = false;
    const updatedDetails = details.map((detail) => {
      let agendaChanged = false;
      const newAgenda = (detail.agenda ?? []).map((item) => {
        if (item.routineId === routine.routineId && (item.exercises ?? []).some((ex) => ex.id === exercise.id)) {
          const newExercises = (item.exercises ?? []).map((ex) =>
            ex.id === exercise.id ? { ...ex, isFinished: true } : ex
          );
          agendaChanged = true;
          return { ...item, exercises: newExercises };
        }
        return item;
      });
      if (agendaChanged) updated = true;
      return agendaChanged ? { ...detail, agenda: newAgenda } : detail;
    });
    if (updated) {
      this.detailsState.set(updatedDetails);
      this.toastr.success('Ejercicio marcado como finalizado.');
      // Verificar si el plan está completado tras marcar ejercicio
      setTimeout(() => this.checkIfPlanCompleted(), 0);
    }

    // 2. Actualizar la rutina en backend
    const detail = updatedDetails.find((d) =>
      (d.agenda ?? []).some(
        (item) =>
          item.routineId === routine.routineId &&
          (item.exercises ?? []).some((ex) => ex.id === exercise.id),
      ),
    );
    const agendaItem = (detail?.agenda ?? []).find(
      (item) =>
        item.routineId === routine.routineId &&
        (item.exercises ?? []).some((ex) => ex.id === exercise.id),
    );

    var listaEjercicios: RoutineExercise[] = [];
    agendaItem?.exercises?.forEach((ex: any) => {
      var ejercicio: RoutineExercise = {
        id: ex.id,
        exerciseId: ex.id,
        exerciseName: ex.name,
        exerciseDescription: ex.description,
        sets: ex.assignedSets ?? 3,
        reps: ex.assignedReps ?? 10,
        weight: ex.assignedWeight ?? 0,
        isFinished: ex.id === exercise.id ? true : !!ex.isFinished
      };
      listaEjercicios.push(ejercicio);
    });

    const routinePayload: Routine = {
      id: agendaItem?.routineId?.toString() ?? '0',
      name: '-',
      description: '-',
      isCustomized: false,
      planId: '0',
      week: agendaItem?.week ?? 0,
      day: agendaItem?.day ?? '',
      exercises: listaEjercicios,
    };

    const request$: Observable<Routine> =
      this.routinesApiService.update(routinePayload);
    request$.pipe(take(1)).subscribe({
      next: (result) => {
        // Actualización exitosa en backend
      },
      error: () =>
        this.toastr.error(
          `No se pudo sincronizar la rutina del semana `,
        ),
    });
  }


  private updateRoutineExercise(
    detail: AssignmentDetail,
    currentRoutine: Routine,
    week: number | undefined,
    day: string,
    exerciseId: string,
    exerciseKey: string,
  ): void {
    const hasMatchingExercise = currentRoutine.exercises.some(
      (exercise) => String(exercise.id) === String(exerciseId),
    );

    if (!hasMatchingExercise) {
      this.toastr.error(
        'No se encontró el ejercicio dentro de la rutina asociada.',
      );
      this.removeUpdatingExerciseKey(exerciseKey);
      return;
    }

    // Actualizar el campo isFinished en el nivel de routineExercises
    const updatedRoutine: Routine = {
      ...currentRoutine,
      exercises: currentRoutine.exercises.map((exercise) =>
        String(exercise.id) === String(exerciseId)
          ? { ...exercise, isFinished: true }
          : exercise,
      ),
    };

    // No es necesario modificar AssignmentDetail.agenda.exercises para isFinished

    this.routinesApiService
      .update(updatedRoutine)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const nextRoutine: Routine = {
            ...updatedRoutine,
            ...response,
            exercises: response?.exercises?.length
              ? response.exercises
              : updatedRoutine.exercises,
          };

          this.routinesState.update((routines) =>
            routines.map((routine) =>
              routine.id === currentRoutine.id ? { ...nextRoutine } : routine,
            ),
          );

          this.hasAutoScrolledToFinished = false;
          this.toastr.success(
            'Ejercicio marcado como finalizado.',
          );
          this.removeUpdatingExerciseKey(exerciseKey);
        },
        error: () => {
          this.toastr.error(
            'No se pudo actualizar la rutina del ejercicio.',
          );
          this.removeUpdatingExerciseKey(exerciseKey);
        },
      });
  }

  private getDefaults(intensity?: string): {
    sets: number;
    reps: number;
    weight: number;
  } {
    return (
      this.defaultsByIntensity[intensity ?? ''] ??
      this.defaultsByIntensity['Media']
    );
  }

  private buildUpdatedDetail(
    detail: AssignmentDetail,
    week: number | undefined,
    day: string,
    exerciseId: string,
  ): AssignmentDetail {
    return {
      ...detail,
      agenda: (detail.agenda ?? []).map((item) => ({
        ...item,
        exercises: (item.exercises ?? []).map((exercise) => {
          const isTargetExercise =
            Number(item.week) === Number(week) &&
            item.day === day &&
            exercise.id === exerciseId;
          return isTargetExercise
            ? { ...exercise, isFinished: true }
            : exercise;
        }),
      })),
    };
  }

  private scrollToLastFinishedExercise(): void {
    if (this.hasAutoScrolledToFinished) {
      return;
    }

    const renderedItems = this.exerciseItems?.toArray() ?? [];
    if (!renderedItems.length) {
      return;
    }

    // Buscar el primer ejercicio que NO esté finalizado
    const firstUnfinishedItem = renderedItems.find(
      (item) => item.nativeElement.dataset['finished'] !== 'true'
    );

    this.hasAutoScrolledToFinished = true;

    firstUnfinishedItem?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  private getExerciseKey(
    detailId: number,
    week: number | undefined,
    day: string,
    exerciseId: string,
  ): string {
    return `${detailId}-${week ?? 0}-${day}-${exerciseId}`;
  }

  private removeUpdatingExerciseKey(exerciseKey: string): void {
    this.updatingExerciseKeys.update((keys) =>
      keys.filter((key) => key !== exerciseKey),
    );
  }

  private cloneDetails(details: AssignmentDetail[]): AssignmentDetail[] {
    return details.map((detail) => this.cloneDetail(detail));
  }

  private cloneDetail(detail: AssignmentDetail): AssignmentDetail {
    return {
      ...detail,
      agenda: (detail.agenda ?? []).map((item) => ({
        ...item,
        exercises: (item.exercises ?? []).map((exercise) => ({ ...exercise })),
      })),
    };
  }

      /**
     * Estadísticas generales calculadas para el resumen
     */
    public get generalStats() {
      const detail = this.latestDetail;
      if (!detail) {
        return {
          completedRoutines: 0,
          completedExercises: 0,
          trainingDays: 0,
        };
      }

      // Rutinas completadas: agenda con todos los ejercicios finalizados
      const agenda = (detail.agenda ?? []).filter(item => (item.exercises?.length ?? 0) > 0);
      const completedRoutines = agenda.filter(item => (item.exercises ?? []).every(ex => !!ex.isFinished)).length;

      // Ejercicios completados: suma de todos los ejercicios finalizados
      const completedExercises = agenda.reduce((acc, item) => acc + (item.exercises?.filter(ex => !!ex.isFinished).length ?? 0), 0);

      // Días entrenados: cantidad de días únicos con al menos un ejercicio finalizado
      const daysSet = new Set(
        agenda
          .filter(item => (item.exercises ?? []).some(ex => !!ex.isFinished))
          .map(item => `${item.week ?? ''}-${item.day ?? ''}`)
      );
      const trainingDays = daysSet.size;

      return {
        completedRoutines,
        completedExercises,
        trainingDays,
      };
    }

      // Estado para mostrar el splash de felicitación
  public showCongratsSplash = signal(false);

  /**
   * Detecta si el usuario ha completado todas las rutinas y muestra el splash
   */
  private checkIfPlanCompleted() {
    const detail = this.latestDetail;
    if (!detail) return;
    const agenda = this.getAgendaWithExercises(detail);
    const total = agenda.length;
    const finished = agenda.filter(item => (item.exercises ?? []).every(ex => !!ex.isFinished)).length;
    if (total > 0 && finished === total) {
      if (!this.showCongratsSplash()) {
        this.showCongratsSplash.set(true);
        setTimeout(() => this.showCongratsSplash.set(false), 5000); // Oculta tras 5s
      }
    }
  }

    /**
   * Calcula la semana actual del plan según la fecha de inicio y la fecha actual
   */
  getCurrentWeek(detail: AssignmentDetail): number {
    if (!detail?.startDate) return 1;
    const start = new Date(detail.startDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.min(this.getEffectiveWeeks(detail), Math.floor(diff / 7) + 1));
  }

    /**
   * Calcula el porcentaje de progreso del plan
   */
  getPlanProgress(detail: AssignmentDetail | null): number {
    if (!detail) return 0;
    const total = this.getAgendaWithExercises(detail)?.length || 1;
    return Math.round((this.generalStats.completedRoutines / total) * 100);
  }
}
