import { AsyncPipe } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AskDialogComponent } from '../../../shared/ui/ask-dialog.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import {
  ExerciseCatalogItem,
  MuscleGroupCatalogItem,
  NewUserPlanAssignment,
  Routine,
  TrainingPlan,
  TrainingPlanScheduleItem,
  UserRecord
} from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { AssignmentsStore } from '../../assignments/data-access/assignments.store';
import { AssignmentDetail } from '../../assignments/data-access/assignments-api.service';
import { ExercisesApiService } from '../../exercises/data-access/exercises-api.service';
import { MuscleGroupsApiService } from '../../exercises/data-access/muscle-groups-api.service';
import { RoutinesApiService } from '../../routines/data-access/routines-api.service';
import { UsersStore } from '../../users/data-access/users.store';
import { MyTrainingPlanComponent } from '../components/my-training-plan/my-training-plan.component';
import {
  PlanCustomizeDialogComponent,
  PlanCustomizeDialogResult
} from '../components/plan-customize-dialog/plan-customize-dialog.component';
import { TrainingPlansStore } from '../data-access/training-plans.store';

@Component({
  selector: 'app-training-plans-page',
  standalone: true,
  imports: [
    AsyncPipe,
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
    MyTrainingPlanComponent
  ],
  templateUrl: './training-plans.page.html',
  styleUrl: './training-plans.page.scss'
})
export class TrainingPlansPageComponent implements OnInit {
  @ViewChild('formDialog') private formDialogRef!: TemplateRef<unknown>;
  private dialogRef: MatDialogRef<unknown> | null = null;

  readonly editingId = signal<string | null>(null);
  readonly routines = signal<Routine[]>([]);
  readonly exercises = signal<ExerciseCatalogItem[]>([]);
  readonly muscleGroups = signal<MuscleGroupCatalogItem[]>([]);
  readonly users = signal<UserRecord[]>([]);
  readonly availablePlans = signal<TrainingPlan[]>([]);
  readonly userRoleId = signal<number | null>(null);
  readonly userAssignmentDetails = signal<AssignmentDetail[]>([]);
  readonly scheduleItems = signal<TrainingPlanScheduleItem[]>([]);
  readonly displayedColumns = ['name', 'durationWeeks', 'objective', 'sessions', 'actions'];
  readonly scheduleColumns = ['week', 'day', 'routineName', 'actions'];
  readonly days = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  readonly focusOptions = ['Hipertrofia', 'Resistencia', 'Definicion', 'Fuerza funcional'];
  readonly intensityOptions = ['Baja', 'Media', 'Alta'];
  readonly title = signal('Training Plans');
  readonly subtitle = signal('Diseña planes por semanas y asigna rutinas por dia con vista estructurada.');
  readonly meta = signal('Entrenadores');
  readonly isMobileView = signal(window.matchMedia('(max-width: 720px)').matches);
  readonly sortedSchedule = computed(() =>
    [...this.scheduleItems()].sort((a, b) => {
      if (a.week !== b.week) {
        return a.week - b.week;
      }
      return this.days.indexOf(a.day) - this.days.indexOf(b.day);
    })
  );

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    durationWeeks: [8, [Validators.required, Validators.min(1)]],
    objective: ['', Validators.required]
  });

  readonly scheduleForm = this.formBuilder.nonNullable.group({
    week: [1, [Validators.required, Validators.min(1)]],
    day: ['Lunes', Validators.required],
    routineId: ['', Validators.required]
  });


  private readonly toastr = inject(ToastrService);

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly routinesApiService: RoutinesApiService,
    private readonly exercisesApiService: ExercisesApiService,
    private readonly muscleGroupsApiService: MuscleGroupsApiService,
    private readonly usersStore: UsersStore,
    private readonly dialog: MatDialog,
    private readonly assignmentsStore: AssignmentsStore,
    public readonly store: TrainingPlansStore
  ) {
    // Escuchar cambios de tamaño de pantalla para actualizar la señal
    window.matchMedia('(max-width: 720px)').addEventListener('change', (e) => {
      this.isMobileView.set(e.matches);
    });
  }

  ngOnInit(): void {
    const sessionUser = this.authService.snapshot?.user;
    const companyId = this.authService.snapshot?.user.idEmpresa;
    this.userRoleId.set(this.resolveRoleId(sessionUser));

    if (this.isRole2() && sessionUser?.id) {
      this.assignmentsStore
        .getDetailByUser(sessionUser.id)
        .pipe(take(1))
        .subscribe((details) => {
          this.userAssignmentDetails.set(Array.isArray(details) ? details : []);
          this.title.set('Mi plan');
          this.subtitle.set('Consulta tu plan');
          this.meta.set('Usuario');
        });
      return;
    }

    this.store.load();
    this.store.vm$.subscribe((vm) => this.availablePlans.set(Array.isArray(vm.data) ? vm.data : []));

    this.routinesApiService
      .getAll()
      .pipe(take(1))
      .subscribe((routines) => this.routines.set(routines.filter((routine) => !routine.isCustomized)));

    this.exercisesApiService
      .getAll()
      .pipe(take(1))
      .subscribe((exercises) => this.exercises.set(exercises));

    this.muscleGroupsApiService
      .getAll(companyId!!)
      .pipe(take(1))
      .subscribe((muscleGroups) => this.muscleGroups.set(muscleGroups));

    this.usersStore.load();
    this.usersStore.vm$.subscribe((vm) => this.users.set(vm.data.filter((user) => user.active)));
  }

  isRole1(): boolean {
    return this.userRoleId() === 1;
  }

  isRole2(): boolean {
    return this.userRoleId() === 2;
  }

  edit(plan: TrainingPlan): void {
    this.editingId.set(plan.id);
    this.form.patchValue({
      name: plan.name,
      durationWeeks: plan.durationWeeks,
      objective: plan.objective
    });
    this.scheduleItems.set([...plan.schedule]);
    this.openDialog();
  }

  openDialog(): void {
    const isMobile = window.matchMedia('(max-width: 720px)').matches;
    this.dialogRef = this.dialog.open(this.formDialogRef, {
      width: isMobile ? '100vw' : '920px',
      maxWidth: isMobile ? '100vw' : '95vw'
    });
    this.dialogRef.afterClosed().pipe(take(1)).subscribe(() => this.resetForm());
  }

  openCustomizationDialog(): void {
    const dialogRef = this.dialog.open<PlanCustomizeDialogComponent, {
      plans: TrainingPlan[];
      exercises: ExerciseCatalogItem[];
      muscleGroups: MuscleGroupCatalogItem[];
      users: UserRecord[];
      companyId?: number;
      focusOptions: string[];
      intensityOptions: string[];
    }, PlanCustomizeDialogResult>(PlanCustomizeDialogComponent, {
      width: '1880px',
      maxWidth: '100vw',
      maxHeight: '96vh',
      data: {
        plans: this.availablePlans(),
        exercises: this.exercises(),
        muscleGroups: this.muscleGroups(),
        users: this.users(),
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
        if (!selectedUser) {
          this.toastr.error('Selecciona un usuario para crear el plan personalizado.', 'Error', { positionClass: 'toast-top-right' });
          return;
        }

        const customPlanName = `PLAN PERSONALIZADO ${selectedUser.nombre}`;

        const payload: NewUserPlanAssignment = {
          userId: selectedUser.id,
          userName: selectedUser.nombre,
          planId: '0',
          planName: customPlanName,
          startDate: new Date(result.startDate).toISOString(),
          isCustomized: true
        };

        this.assignmentsStore
          .create(payload)
          .pipe(take(1))
          .subscribe(() => {
            this.toastr.success(`Plan ${customPlanName} creado para ${selectedUser.nombre}.`, 'Éxito', { positionClass: 'toast-top-right' });
          });
      });
  }

  remove(plan: TrainingPlan): void {
    this.dialog
      .open(AskDialogComponent, {
        data: {
          message: `¿Eliminar el plan ${plan.name}?`,
          title: 'Confirmar eliminación'
        }
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe(result => {
        if (!result) return;
        this.store
          .remove(plan.id)
          .pipe(take(1))
          .subscribe(() => this.toastr.success('Plan eliminado.', 'Eliminado', { timeOut: 2500, positionClass: 'toast-top-right' }));
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.scheduleItems().length) {
      this.toastr.error('Agrega al menos una rutina al plan.', 'Error', { positionClass: 'toast-top-right' });
      return;
    }

    const rawValue = this.form.getRawValue();
    const payload: TrainingPlan = {
      id: this.editingId() ?? '0',
      name: rawValue.name,
      durationWeeks: rawValue.durationWeeks,
      objective: rawValue.objective,
      schedule: [...this.scheduleItems()]
    };

    const request$ = this.editingId() ? this.store.update(payload) : this.store.create(payload);
    request$.pipe(take(1)).subscribe(() => {
      this.toastr.success(this.editingId() ? 'Plan actualizado.' : 'Plan creado.', 'Éxito', { positionClass: 'toast-top-right' });
      this.dialogRef?.close();
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.scheduleItems.set([]);
    this.form.reset({
      name: '',
      durationWeeks: 8,
      objective: ''
    });
    this.scheduleForm.reset({
      week: 1,
      day: 'Lunes',
      routineId: ''
    });
  }

  addScheduleItem(): void {
    if (this.scheduleForm.invalid) {
      this.scheduleForm.markAllAsTouched();
      return;
    }

    const rawValue = this.scheduleForm.getRawValue();
    const selectedRoutine = this.routines().find((routine) => routine.id === rawValue.routineId);
    if (!selectedRoutine) {
      return;
    }

    const routineAlreadyAdded = this.scheduleItems().some(
      (item) => item.routineId === selectedRoutine.id && item.day === rawValue.day && item.week === rawValue.week
    );
    if (routineAlreadyAdded) {
      this.toastr.error('La rutina ya esta agregada para ese dia y semana. Cambia el dia o la semana.', 'Error', { positionClass: 'toast-top-right' });
      return;
    }

    this.scheduleItems.update((items) => [
      ...items,
      {
        id: String(Date.now()),
        week: rawValue.week,
        day: rawValue.day,
        routineId: selectedRoutine.id,
        routineName: selectedRoutine.name
      }
    ]);

    this.scheduleForm.patchValue({
      week: rawValue.week,
      day: 'Lunes',
      routineId: ''
    });
  }

  removeScheduleItem(id: string): void {
    this.scheduleItems.update((items) => items.filter((item) => item.id !== id));
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
}
