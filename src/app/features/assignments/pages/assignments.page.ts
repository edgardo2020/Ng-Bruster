import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, switchMap, take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AskDialogComponent } from '../../../shared/ui/ask-dialog.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ToastrService } from 'ngx-toastr';

import {
  ExerciseCatalogItem,
  MuscleGroupCatalogItem,
  NewUserPlanAssignment,
  Routine,
  RoutineExercise,
  TrainingPlan,
  TrainingPlanScheduleItem,
  UserPlanAssignment,
  UserRecord
} from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { ExercisesApiService } from '../../exercises/data-access/exercises-api.service';
import { MuscleGroupsApiService } from '../../exercises/data-access/muscle-groups-api.service';
import {
  AssignedExerciseItem,
  PlanCustomizeDialogComponent,
  PlanCustomizeDialogResult
} from '../components/plan-customize-dialog/plan-customize-dialog.component';
import { MyAssignmentPlanComponent } from '../components/my-assignment-plan/my-assignment-plan.component';
import { AssignmentDetail } from '../data-access/assignments-api.service';
import { RoutinesApiService } from '../../routines/data-access/routines-api.service';
import { TrainingPlansApiService } from '../../training-plans/data-access/training-plans-api.service';
import { UsersApiService } from '../../users/data-access/users-api.service';
import { AssignmentsStore } from '../data-access/assignments.store';
import { T } from '@angular/cdk/keycodes';

@Component({
  selector: 'app-assignments-page',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    AskDialogComponent,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    MyAssignmentPlanComponent
  ],
  templateUrl: './assignments.page.html',
  styleUrl: './assignments.page.scss'
})
export class AssignmentsPageComponent implements OnInit {
  @ViewChild('formDialog') private formDialogRef!: TemplateRef<unknown>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly usersApiService = inject(UsersApiService);
  private readonly routinesApiService = inject(RoutinesApiService);
  private readonly trainingPlansApiService = inject(TrainingPlansApiService);
  private readonly exercisesApiService = inject(ExercisesApiService);
  private readonly muscleGroupsApiService = inject(MuscleGroupsApiService);
  private dialogRef: MatDialogRef<unknown> | null = null;
  private readonly toastr = inject(ToastrService);

  readonly store = inject(AssignmentsStore);
  readonly editingId = signal<number | null>(null);
  readonly editingUserName = signal<string>('');
  readonly editingAssignment = signal<UserPlanAssignment | null>(null);
  readonly exercises = signal<ExerciseCatalogItem[]>([]);
  readonly muscleGroups = signal<MuscleGroupCatalogItem[]>([]);
  readonly users = signal<UserRecord[]>([]);
  // Devuelve solo usuarios sin asignación activa
  readonly usersWithoutAssignment = computed(() => {
    const assignedUserIds = new Set((this.currentPlanByUser() ?? []).map(a => String(a.userId)));
    return this.users().filter(u => !assignedUserIds.has(String(u.id)));
  });
  readonly plans = signal<TrainingPlan[]>([]);
  readonly userRoleId = signal<number | null>(null);
  readonly userAssignmentDetails = signal<AssignmentDetail[]>([]);
  readonly focusOptions = ['Hipertrofia', 'Resistencia', 'Definicion', 'Fuerza funcional'];
  readonly intensityOptions = ['Baja', 'Media', 'Alta'];
  readonly displayedColumns = ['userName', 'planName', 'startDate', 'actions'];
  readonly title = signal('Asignaciones');
  readonly subtitle = signal('Visualiza y administra las asignaciones de planes de entrenamiento para tus usuarios.');
  readonly meta = signal('Entrenador');
  readonly isMobileView = signal(window.matchMedia('(max-width: 720px)').matches);
  readonly currentPlanByUser = computed(() => {
    const assignments = [...(this.storeData() ?? [])];
    const grouped = new Map<string, UserPlanAssignment>();

    assignments
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .forEach((assignment) => {
        if (!grouped.has(assignment.userId)) {
          grouped.set(assignment.userId, assignment);
        }
      });

    return Array.from(grouped.values());
  });

  readonly form = this.formBuilder.nonNullable.group({
    userId: ['', Validators.required],
    planId: ['', Validators.required],
    startDate: [this.todayIsoDate(), Validators.required]
  });

  private readonly storeData = signal<UserPlanAssignment[]>([]);

  ngOnInit(): void {
    const sessionUser = this.authService.snapshot?.user;
    this.userRoleId.set(this.resolveRoleId(sessionUser));

    if (this.isRole2() && sessionUser?.id) {
      this.store
        .getDetailByUser(sessionUser.id)
        .pipe(take(1))
        .subscribe((details) => this.userAssignmentDetails.set(Array.isArray(details) ? details : []));
        this.meta.set('Trainee');
        this.subtitle.set('');
        this.title.set('Plan Personalizado');
      return;
    }

    this.store.load();
    this.store.vm$.subscribe((vm) => this.storeData.set(Array.isArray(vm.data) ? vm.data : []));

    const companyId = this.authService.snapshot?.user.idEmpresa;
    const usersRequest$ = companyId ? this.usersApiService.getByEmpresa(companyId) : this.usersApiService.getAll();

    usersRequest$
      .pipe(take(1))
      .subscribe((users) => this.users.set(users.filter((user) => user.idRol === 2)));

    this.trainingPlansApiService
      .getAll()
      .pipe(take(1))
      .subscribe((plans) => this.plans.set(plans));

    this.exercisesApiService
      .getAll()
      .pipe(take(1))
      .subscribe((exercises) => this.exercises.set(exercises));

    this.muscleGroupsApiService
      .getAll()
      .pipe(take(1))
      .subscribe((muscleGroups) => this.muscleGroups.set(muscleGroups));
  }

  isRole1(): boolean {
    return this.userRoleId() === 1;
  }

  isRole2(): boolean {
    return this.userRoleId() === 2;
  }

  edit(assignment: UserPlanAssignment): void {
    if (assignment.isCustomized) {
      this.store
        .getDetail(assignment.id)
        .pipe(take(1))
        .subscribe({
          next: (detail) => this.openCustomizationDialog(assignment, detail),
          error: () => {
            this.toastr.error('No se pudo obtener el detalle de la asignacion personalizada.', 'Error', { positionClass: 'toast-top-right' });
            this.openCustomizationDialog(assignment);
          }
        });
      return;
    }

    this.editingId.set(assignment.id);
    this.editingUserName.set(assignment.userName);
    this.editingAssignment.set(assignment);
    this.form.patchValue({
      userId: assignment.userId,
      planId: assignment.planId,
      startDate: this.toIsoDate(assignment.startDate)
    });
    this.form.controls.userId.disable();
    this.openDialog();
  }

  openCreateDialog(): void {
    this.resetForm();
    this.openDialog();
  }

  openCustomizationDialog(customizedAssignment?: UserPlanAssignment, assignmentDetail?: AssignmentDetail): void {
    console.log(customizedAssignment)
    console.log(assignmentDetail)
    const lockedUserId = assignmentDetail?.userId ?? customizedAssignment?.userId;
    const lockedUserName = assignmentDetail?.userName ?? customizedAssignment?.userName;
    const lockedStartDate = assignmentDetail?.startDate ?? customizedAssignment?.startDate;
    const lockedPlanName = assignmentDetail?.planName ?? customizedAssignment?.planName;

    const dialogRef = this.dialog.open<PlanCustomizeDialogComponent, {
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
      initialAgenda?: PlanCustomizeDialogResult['selectedAgenda'];
      focusOptions: string[];
      intensityOptions: string[];
    }, PlanCustomizeDialogResult>(PlanCustomizeDialogComponent, {
      width: '1880px',
      maxWidth: '100vw',
      maxHeight: '96vh',
      data: {
        plans: this.plans(),
        exercises: this.exercises(),
        muscleGroups: this.muscleGroups(),
        users: this.users(),
        companyId: this.authService.snapshot?.user.idEmpresa,
        lockedAssignment: customizedAssignment && lockedUserId && lockedUserName && lockedStartDate && lockedPlanName
          ? {
            userId: lockedUserId,
            userName: lockedUserName,
            startDate: lockedStartDate,
            planName: lockedPlanName
          }
          : undefined,
        editingAssignmentId: customizedAssignment?.id,
        initialDetail: assignmentDetail,
        initialFocus: assignmentDetail?.focus,
        initialIntensity: assignmentDetail?.intensity,
        initialNotes: assignmentDetail?.notes,
        initialWeeks: assignmentDetail?.durationWeeks,
        initialAgenda: this.normalizeDetailAgenda(assignmentDetail?.agenda),
        focusOptions: this.focusOptions,
        intensityOptions: this.intensityOptions
      }
    });

    dialogRef
      .afterClosed()
      .pipe(take(1))
      .subscribe((result) => {
        if (!result) {
          return;
        }

        const selectedUser = this.users().find((user) => String(user.id) === String(result.userId));
        const resolvedUserId = selectedUser?.id ?? customizedAssignment?.userId;
        const resolvedUserName = selectedUser?.nombre ?? customizedAssignment?.userName;

        if (!resolvedUserId || !resolvedUserName) {
          this.toastr.error('Selecciona un usuario para crear el plan personalizado.', 'Error', { positionClass: 'toast-top-right' });
          return;
        }

        const selectedExercises = this.toRoutineExercises(result.selectedAgenda, result.intensity);
        if (!selectedExercises.length) {
          //this.toastr.error('Debes agregar al menos un ejercicio a la agenda para crear la rutina.', 'Error', { positionClass: 'toast-top-right' });
          //return;
        }

        const customRoutineName = `RUTINA PERSONALIZADA ${resolvedUserName}`;
        const customPlanName = `PLAN PERSONALIZADO ${resolvedUserName}`;
        const routinePayload: Routine = {
          id: '0',
          name: customRoutineName,
          description: `Rutina generada para ${resolvedUserName}. Objetivo: ${result.focus}. Intensidad: ${result.intensity}.`,
          exercises: selectedExercises
        };

        this.routinesApiService
          .create(routinePayload)
          .pipe(take(1))
          .pipe(
            switchMap((createdRoutine) => {
              const planPayload: TrainingPlan = {
                id: '0',
                name: customPlanName,
                durationWeeks: result.durationWeeks,
                objective: `Plan personalizado para ${resolvedUserName}. Objetivo: ${result.focus}. Intensidad: ${result.intensity}. ${result.notes}`.trim(),
                schedule: this.buildPlanSchedule(result.selectedAgenda, createdRoutine, result.durationWeeks)
              };

              return this.trainingPlansApiService.create(planPayload);
            }),
            switchMap((createdPlan) => {
              const payload: NewUserPlanAssignment = {
                userId: resolvedUserId,
                userName: resolvedUserName,
                planId: createdPlan.id,
                planName: createdPlan.name,
                startDate: new Date(result.startDate).toISOString(),
                isCustomized: true
              };

              return this.store.create(payload).pipe(map(() => createdPlan.name));
            })
          )
          .subscribe({
            next: (planName) => {
              this.toastr.success(`Rutina, plan y asignacion creados correctamente: ${planName}.`, 'Éxito', { positionClass: 'toast-top-right' });
              this.trainingPlansApiService
                .getAll()
                .pipe(take(1))
                .subscribe((plans) => this.plans.set(plans));
            },
            error: () => {
              this.toastr.error('No se pudo crear la rutina, el plan personalizado o la asignacion.', 'Error', { positionClass: 'toast-top-right' });
            }
          });
      });
  }

  remove(assignment: UserPlanAssignment): void {
    this.dialog
      .open(AskDialogComponent, {
        data: {
          message: `¿Eliminar asignación de ${assignment.userName}?`,
          title: 'Confirmar eliminación'
        }
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe(result => {
        if (!result) return;
        this.store
          .remove(assignment.id)
          .pipe(take(1))
          .subscribe(() => this.toastr.success('Asignación eliminada.', 'Eliminado', { timeOut: 2500, positionClass: 'toast-top-right' }));
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const isEditing = this.editingId() != null;
    const selectedUser = this.users().find((user) => String(user.id) === String(rawValue.userId));
    const selectedPlan = this.plans().find((plan) => plan.id === rawValue.planId);

    if (!selectedPlan) {
      return;
    }

    if (!isEditing && !selectedUser) {
      return;
    }

    const editingAssignment = this.editingAssignment();
    const resolvedUserId = selectedUser?.id ?? editingAssignment?.userId;
    const resolvedUserName = selectedUser?.nombre ?? editingAssignment?.userName;

    if (!resolvedUserId || !resolvedUserName) {
      return;
    }

    const basePayload: NewUserPlanAssignment = {
      userId: resolvedUserId,
      userName: resolvedUserName,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      startDate: new Date(rawValue.startDate).toISOString(),
      isCustomized: editingAssignment?.isCustomized ?? false
    };

    const request$ = this.editingId()
      ? this.store.update({
        ...basePayload,
        id: this.editingId()!
      })
      : this.store.create(basePayload);
    request$.pipe(take(1)).subscribe(() => {
      this.toastr.success(this.editingId() ? 'Asignacion actualizada.' : 'Plan asignado al usuario.', 'Éxito', { positionClass: 'toast-top-right' });
      this.dialogRef?.close();
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.editingUserName.set('');
    this.editingAssignment.set(null);
    this.form.controls.userId.enable();
    this.form.reset({
      userId: '',
      planId: '',
      startDate: this.todayIsoDate()
    });
  }

  asArray<T>(value: T[] | null | undefined): T[] {
    return Array.isArray(value) ? value : [];
  }

  private resolveRoleId(user: { idRol?: number; roles?: string[] } | null | undefined): number | null {
    if (typeof user?.idRol === 'number') {
      return user.idRol;
    }

    if (user?.roles?.includes('Trainer')) {
      return 1;
    }

    if (user?.roles?.includes('Trainee')) {
      return 2;
    }

    return null;
  }

  private openDialog(): void {
    this.dialogRef = this.dialog.open(this.formDialogRef, { width: '720px', maxWidth: '92vw' });
    this.dialogRef.afterClosed().pipe(take(1)).subscribe(() => this.resetForm());
  }

  private todayIsoDate(): string {
    return this.toIsoDate(new Date().toISOString());
  }

  private toIsoDate(value: string): string {
    return new Date(value).toISOString().slice(0, 10);
  }

  private toRoutineExercises(
    selectedAgenda: PlanCustomizeDialogResult['selectedAgenda'],
    intensity: string
  ): RoutineExercise[] {
    const defaultsByIntensity: Record<string, { sets: number; reps: number; weight: number }> = {
      Baja: { sets: 3, reps: 12, weight: 15 },
      Media: { sets: 4, reps: 10, weight: 20 },
      Alta: { sets: 5, reps: 8, weight: 25 }
    };
    const defaults = defaultsByIntensity[intensity] ?? defaultsByIntensity['Media'];
    const byExerciseId = new Map<string, RoutineExercise>();

    selectedAgenda
      .flatMap((entry) => entry.exercises)
      .forEach((exercise, index) => {
        if (byExerciseId.has(exercise.id)) {
          return;
        }

        const assignedExercise = exercise as AssignedExerciseItem;

        byExerciseId.set(exercise.id, {
          id: `custom-routine-ex-${Date.now()}-${index}`,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          sets: defaults.sets,
          reps: assignedExercise.assignedReps ?? defaults.reps,
          weight: assignedExercise.assignedWeight ?? defaults.weight
        });
      });

    return Array.from(byExerciseId.values());
  }

  private buildPlanSchedule(
    selectedAgenda: PlanCustomizeDialogResult['selectedAgenda'],
    routine: Routine,
    durationWeeks: number
  ): TrainingPlanScheduleItem[] {
    const activeSlots = selectedAgenda.filter((entry) => entry.exercises.length > 0);
    if (activeSlots.length) {
      return activeSlots.map((entry, index) => ({
        id: `custom-schedule-${Date.now()}-${entry.week}-${index}`,
        week: entry.week,
        day: entry.day,
        routineId: routine.id,
        routineName: routine.name
      }));
    }

    const totalWeeks = Math.max(1, Math.floor(durationWeeks || 1));
    return Array.from({ length: totalWeeks }, (_, index) => ({
      id: `custom-schedule-${Date.now()}-${index + 1}-0`,
      week: index + 1,
      day: 'Lunes',
      routineId: routine.id,
      routineName: routine.name
    }));
  }

  private normalizeDetailAgenda(agenda: AssignmentDetail['agenda']): PlanCustomizeDialogResult['selectedAgenda'] {
    if (!Array.isArray(agenda)) {
      return [];
    }

    return agenda.map((entry) => ({
      week: Number.isFinite(Number(entry.week)) ? Number(entry.week) : 1,
      day: entry.day,
      routineId: entry.routineId != null ? String(entry.routineId) : undefined,
      exercises: Array.isArray(entry.exercises) ? entry.exercises : []
    }));
  }
}
