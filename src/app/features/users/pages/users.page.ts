import { environment } from '../../../../environments/environment';
// ...existing code...
import { AsyncPipe, CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, DestroyRef, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, startWith, take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { UserHistoryDialogComponent, UserHistoryDialogData, UserHistoryRecord } from '../components/user-history-dialog/user-history-dialog.component';

import { MembershipStatus, Routine, UserRecord } from '../../../core/models/gym.models';
import { AssignmentDetail, AssignmentsApiService } from '../../assignments/data-access/assignments-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ExercisesApiService } from '../../exercises/data-access/exercises-api.service';
import { MuscleGroupsApiService } from '../../exercises/data-access/muscle-groups-api.service';
import {
  PlanCustomizeDialogComponent,
  PlanCustomizeDialogResult
} from '../../assignments/components/plan-customize-dialog/plan-customize-dialog.component';
import { TrainingPlansApiService } from '../../training-plans/data-access/training-plans-api.service';
import {
  UserRoutinesDetailDialogComponent,
  UserRoutinesDetailDialogData
} from '../components/user-routines-detail-dialog/user-routines-detail-dialog.component';
import { FoodsCatalogDialogComponent } from '../components/foods-catalog-dialog/foods-catalog-dialog.component';
import {
  UserNutritionPlanDialogComponent,
  UserNutritionPlanDialogData
} from '../components/user-nutrition-plan-dialog/user-nutrition-plan-dialog.component';
import { RoutinesApiService } from '../../routines/data-access/routines-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { AskDialogComponent } from '../../../shared/ui/ask-dialog.component';
import { UsersStore } from '../data-access/users.store';
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatDialogModule,
    CommonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    PageHeaderComponent,
    UserHistoryDialogComponent,
    UserNutritionPlanDialogComponent
  ],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss'
})
export class UsersPageComponent implements OnInit {
  @ViewChild('formDialog') private formDialogRef!: TemplateRef<unknown>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);
  private readonly assignmentsApiService = inject(AssignmentsApiService);
  private readonly trainingPlansApiService = inject(TrainingPlansApiService);
  private readonly exercisesApiService = inject(ExercisesApiService);
  private readonly muscleGroupsApiService = inject(MuscleGroupsApiService);
  private readonly routinesApiService = inject(RoutinesApiService);
   private readonly toastr = inject(ToastrService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private dialogRef: MatDialogRef<unknown> | null = null;
  public userHistories = new Map<string, UserHistoryRecord[]>();
  public selectedUserForHistory: UserRecord | null = null;
  readonly selectedUserForNutrition = signal<UserRecord | null>(null);

  readonly pageTitle = computed(() => {
    const nut = this.selectedUserForNutrition();
    if (nut) return `Plan alimentacion · ${nut.nombre}`;
    return 'Gesti\u00f3n de usuarios';
  });

  readonly pageSubtitle = computed(() => {
    const nut = this.selectedUserForNutrition();
    if (nut) return 'Administra los planes nutricionales del usuario';
    return 'Clientes y operadores con filtros, roles y estado de membres\u00eda.';
  });

  readonly pageMeta = computed(() => {
    const nut = this.selectedUserForNutrition();
    if (nut) return nut.nombre;
    return 'Usuarios';
  });
  readonly store = inject(UsersStore);
  readonly editingId = signal<string | null>(null);
  readonly editingUser = signal<UserRecord | null>(null);
  readonly displayedColumns = ['nombre', 'roleName', 'membershipStatus', 'expiracion', 'history', 'actions'];
  readonly USER_REGISTRATION_LIMIT = environment.USER_REGISTRATION_LIMIT;
  readonly roleNameMap: Record<number, string> = {
    1: 'Trainer',
    2: 'Trainee',
    3: 'Receptionist'
  };

  getRoleName(idRol: number): string {
    return this.roleNameMap[idRol] || 'Desconocido';
  }

  readonly statusOptions: ReadonlyArray<{ value: MembershipStatus | 'All'; label: string }> = [
    { value: 'All', label: 'Todos' },
    { value: 'Active', label: 'Activa' },
    { value: 'Expired', label: 'Expirada' },
    { value: 'Cancelled', label: 'Cancelada' }
  ];
  readonly membershipStatusLabelMap: Record<MembershipStatus, string> = {
    Active: 'Activa',
    Expired: 'Expirada',
    Cancelled: 'Cancelada'
  };
  readonly membershipValues: MembershipStatus[] = ['Active', 'Expired', 'Cancelled'];

  readonly filtersForm = this.formBuilder.nonNullable.group({
    search: [''],
    idRol: [2 as number | 'All'],
    status: ['All' as MembershipStatus | 'All']
  });

  readonly form = this.formBuilder.nonNullable.group({
    nombre: ['', Validators.required],
    Correo: ['', [Validators.required, Validators.email]],
    Telefono: ['', Validators.required],
    usuario: ['', Validators.required],
    password: ['123456', Validators.required],
    idRol: [2, Validators.required], // 2 = Trainee por defecto
    membershipStatus: ['Active' as MembershipStatus, Validators.required],
    active: [true],
    expiredTime: [null as Date | null]
  });

  ngOnInit(): void {
    this.store.load();

    this.filtersForm.valueChanges
      .pipe(startWith(this.filtersForm.getRawValue()), takeUntilDestroyed(this.destroyRef))
      .subscribe((filters) =>
        this.store.updateFilters({
          search: filters.search,
          idRol: 2,
          status: filters.status
        })
      );
  }

  openDialog(): void {
    // Limitar registro de usuarios usando vm$ y async
    this.store.vm$.pipe(take(1)).subscribe(vm => {
      if (vm.data.length >= this.USER_REGISTRATION_LIMIT) {
        this.toastr.error(`Límite de usuarios alcanzado (${this.USER_REGISTRATION_LIMIT}). No puedes registrar más usuarios.`);
        return;
      }
      this.resetForm();
      this.dialogRef = this.dialog.open(this.formDialogRef, { width: '720px', maxWidth: '92vw' });
      this.dialogRef.afterClosed().pipe(take(1)).subscribe(() => this.resetForm());
    });
  }

  edit(user: UserRecord): void {
    this.editingId.set(user.id);
    this.editingUser.set(user);
    const legacyUser = user as unknown as {
      email?: string;
      phone?: string;
      Correo?: string;
      correo?: string;
      Telefono?: string;
      telefono?: string;
      usuario?: string;
      password?: string;
    };

    this.form.patchValue({
      nombre: user.nombre,
      Correo: user.Correo ?? legacyUser.correo ?? legacyUser.email ?? '',
      Telefono: user.Telefono ?? legacyUser.telefono ?? legacyUser.phone ?? '',
      usuario: legacyUser.usuario ?? '',
      password: legacyUser.password ?? '123456',
      idRol: user.idRol,
      membershipStatus: user.membershipStatus,
      active: user.active,
      expiredTime: user.expiredTime ? new Date(user.expiredTime) : null
    });
    this.setIdentityFieldsEditable(false);
    this.dialogRef = this.dialog.open(this.formDialogRef, { width: '720px', maxWidth: '92vw' });
    this.dialogRef.afterClosed().pipe(take(1)).subscribe(() => this.resetForm());
  }

  remove(user: UserRecord): void {
    this.dialog.open(AskDialogComponent, {
      data: {
        message: `¿Eliminar a ${user.nombre}?`,
        title: 'Confirmar eliminación'
      }
    }).afterClosed().pipe(take(1)).subscribe(result => {
      if (!result) return;
      this.store
        .remove(user)
        .pipe(take(1))
        .subscribe({
          next: () =>  this.toastr.success('Usuario eliminado correctamente.'),
          error: (error: unknown) =>  this.toastr.error(this.getErrorMessage(error, 'No se pudo eliminar el usuario.'))
        });
    });
  }

  openUserAssignments(user: UserRecord): void {
    this.assignmentsApiService
      .getDetailByUser(user.id)
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          if (!data.length) {
             this.toastr.info('Este usuario no tiene asignaciones registradas.');
            return;
          }

          const selectedDetail = this.pickLatestAssignmentDetail(data);
          forkJoin({
            plans: this.trainingPlansApiService.getAll(),
            exercises: this.exercisesApiService.getAll(),
            muscleGroups: this.muscleGroupsApiService.getAll()
          })
            .pipe(take(1))
            .subscribe({
              next: ({ plans, exercises, muscleGroups }) => {
                this.dialog.open(PlanCustomizeDialogComponent, {
                  width: '1880px',
                  maxWidth: '100vw',
                  maxHeight: '96vh',
                  data: {
                    plans,
                    exercises,
                    muscleGroups,
                    users: [user],
                    companyId: this.authService.snapshot?.user.idEmpresa,
                    lockedAssignment: {
                      userId: selectedDetail.userId,
                      userName: selectedDetail.userName,
                      startDate: selectedDetail.startDate,
                      planName: selectedDetail.planName
                    },
                    editingAssignmentId: selectedDetail.id,
                    initialDetail: selectedDetail,
                    initialFocus: selectedDetail.focus,
                    initialIntensity: selectedDetail.intensity,
                    initialNotes: selectedDetail.notes,
                    initialWeeks: selectedDetail.durationWeeks,
                    initialAgenda: this.normalizeDetailAgenda(selectedDetail.agenda)
                  }
                });
              },
              error: (error: unknown) => {
                 this.toastr.error(this.getErrorMessage(error, 'No se pudo abrir el detalle de asignacion.'));
              }
            });
        },
        error: (error: unknown) => {
           this.toastr.error(this.getErrorMessage(error, 'No se pudieron cargar las asignaciones del usuario.'));
        }
      });
  }

  openUserRoutines(user: UserRecord): void {
    this.routinesApiService
      .getByUser(user.id)
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          this.dialog.open<UserRoutinesDetailDialogComponent, UserRoutinesDetailDialogData>(
            UserRoutinesDetailDialogComponent,
            {
              width: '980px',
              maxWidth: '96vw',
              data: {
                userName: user.nombre,
                routines: data
              }
            }
          );
        },
        error: (error: unknown) => {
           this.toastr.error(this.getErrorMessage(error, 'No se pudieron cargar las rutinas del usuario.'));
        }
      });
  }

  openFoodsCatalog(): void {
    this.dialog.open(FoodsCatalogDialogComponent, {
      width: '1200px',
      maxWidth: '98vw',
      maxHeight: '94vh'
    });
  }

  openUserNutritionPlans(user: UserRecord): void {
    if (window.innerWidth <= 768) {
      this.selectedUserForNutrition.set(user);
    } else {
      this.dialog.open<UserNutritionPlanDialogComponent, UserNutritionPlanDialogData>(
        UserNutritionPlanDialogComponent,
        {
          width: '1240px',
          maxWidth: '98vw',
          maxHeight: '94vh',
          data: {
            userId: user.id,
            userName: user.nombre
          }
        }
      );
    }
  }

  closeUserNutrition(): void {
    this.selectedUserForNutrition.set(null);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Forzar idRol a 2 (Trainee) siempre y password por defecto solo si es nuevo
    const isNew = this.editingUser() === null;
    const formValue = this.form.getRawValue();
    const currentEditingUser = this.editingUser();
    const joinedAt = isNew ? new Date().toISOString() : (currentEditingUser?.joinedAt ?? new Date().toISOString());

    const payload: UserRecord = {
      id: this.editingId() ?? crypto.randomUUID(),
      joinedAt,
      ...formValue,
      idRol: isNew ? 2 : formValue.idRol,
      password: isNew ? '123456' : formValue.password,
      expiredTime: formValue.expiredTime ? (formValue.expiredTime as unknown as Date).toISOString() : undefined
    };

    const request$ = isNew ? this.store.create(payload) : this.store.update(payload);

    request$.pipe(take(1)).subscribe({
      next: () => {
         this.toastr.success(isNew ? 'Usuario creado.' : 'Usuario actualizado.');
        this.dialogRef?.close();
      },
      error: (error: unknown) =>  this.toastr.error(this.getErrorMessage(error, 'No se pudo guardar el usuario.'))
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.editingUser.set(null);
    this.setIdentityFieldsEditable(true);
    this.form.reset({
      nombre: '',
      Correo: '',
      Telefono: '',
      usuario: '',
      password: '123456',
      idRol: 2, // Trainee
      membershipStatus: 'Active',
      active: true,
      expiredTime: null
    });
  }

  statusClass(status: MembershipStatus): string {
    return `status-chip--${status.toLowerCase()}`;
  }

  getMembershipStatusLabel(status: MembershipStatus): string {
    return this.membershipStatusLabelMap[status] ?? status;
  }

  isExpired(expiredTime: string): boolean {
    return new Date(expiredTime) < new Date();
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }

  private pickLatestAssignmentDetail(data: AssignmentDetail[]): AssignmentDetail {
    return [...data].sort((left, right) => {
      const leftTime = new Date(left.startDate).getTime();
      const rightTime = new Date(right.startDate).getTime();
      return rightTime - leftTime;
    })[0];
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

  private setIdentityFieldsEditable(editable: boolean): void {
    const correoControl = this.form.controls.Correo;
    const usuarioControl = this.form.controls.usuario;

    if (editable) {
      correoControl.enable({ emitEvent: false });
      usuarioControl.enable({ emitEvent: false });
      return;
    }

    correoControl.disable({ emitEvent: false });
    usuarioControl.disable({ emitEvent: false });
  }

  public showHistory(user: UserRecord): void {
    this.selectedUserForNutrition.set(null);
    this.selectedUserForHistory = user;
  }

  public closeUserHistory(): void {
    this.selectedUserForHistory = null;
  }
}