import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, computed, inject, signal, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { take } from 'rxjs';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ExerciseCatalogItem, MuscleGroupCatalogItem, Routine, RoutineExercise, UserRecord } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ToastrService } from 'ngx-toastr';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { AskDialogComponent } from '../../../shared/ui/ask-dialog.component';
import { ExercisesApiService } from '../../exercises/data-access/exercises-api.service';
import { MuscleGroupsApiService } from '../../exercises/data-access/muscle-groups-api.service';
import {
  RoutineCustomizeDialogComponent,
  RoutineCustomizeDialogResult
} from '../components/routine-customize-dialog/routine-customize-dialog.component';

export interface QuickRoutineResult {
  name: string;
  template: string;
  focus: string;
  intensity: string;
  exercises: RoutineExercise[];
}
import { MyRoutinesPanelComponent } from '../components/my-routines-panel/my-routines-panel.component';
import { RoutinesApiService } from '../data-access/routines-api.service';
import { RoutinesStore } from '../data-access/routines.store';
import { UsersApiService } from '../../users/data-access/users-api.service';

@Component({
  selector: 'app-routines-page',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
      AskDialogComponent,
    MyRoutinesPanelComponent
  ],
  templateUrl: './routines.page.html',
  styleUrl: './routines.page.scss'
})
export class RoutinesPageComponent implements OnInit {
  @ViewChild('formDialog') private formDialogRef!: TemplateRef<unknown>;
  @ViewChild('assignUserDialog') private assignUserDialogRef!: TemplateRef<unknown>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);
  private readonly notificationService = inject(NotificationService);
  private readonly exercisesApiService = inject(ExercisesApiService);
  private readonly muscleGroupsApiService = inject(MuscleGroupsApiService);
  private readonly usersApiService = inject(UsersApiService);
  private readonly routinesApiService = inject(RoutinesApiService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private dialogRef: MatDialogRef<unknown> | null = null;

  readonly store = inject(RoutinesStore);
  readonly editingId = signal<string | null>(null);
  readonly assignTargetRoutine = signal<Routine | null>(null);
  readonly selectedAssignUserId = signal<string | null>(null);
  readonly selectedExercises = signal<RoutineExercise[]>([]);
  readonly exerciseCatalog = signal<ExerciseCatalogItem[]>([]);
  readonly muscleGroupCatalog = signal<MuscleGroupCatalogItem[]>([]);
  readonly selectedMuscleGroupId = signal<number | 0>(0);
  readonly users = signal<UserRecord[]>([]);
  readonly userRoutines = signal<Routine[]>([]);
  readonly userRoleId = signal<number | null>(null);
  readonly focusOptions = ['Hipertrofia', 'Resistencia', 'Definicion', 'Fuerza funcional'];
  readonly intensityOptions = ['Baja', 'Media', 'Alta'];
  readonly displayedColumns = ['name', 'description', 'exercises', 'actions'];
  readonly exerciseColumns = ['exerciseName', 'sets', 'reps', 'weight', 'actions'];
  readonly title = signal('Mis Rutinas');
  readonly subtitle = signal('Crea y personaliza tus rutinas de entrenamiento para alcanzar tus objetivos fitness.');
  readonly meta = signal('Entrenadores');
  readonly exerciseSearchControl = new FormControl<string>('');
  readonly filteredExerciseCatalog = computed(() => {
    const selectedGroupId = this.selectedMuscleGroupId();
    const searchTerm = (this.exerciseSearchControl.value || '').toLowerCase().trim();

    let list = this.exerciseCatalog();

    if (selectedGroupId !== 0) {
      list = list.filter((exercise) => {
        const muscleGroupId = exercise.muscleGroupCatalogId ?? exercise.muscleGroupCatalog?.id ?? 0;
        return muscleGroupId === selectedGroupId;
      });
    }

    if (searchTerm) {
      list = list.filter((exercise) => exercise.name.toLowerCase().includes(searchTerm));
    }

    return list;
  });
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    description: ['', Validators.required]
  });

  readonly exerciseForm = this.formBuilder.nonNullable.group({
    exerciseId: ['', Validators.required],
    sets: [4, [Validators.required, Validators.min(1)]],
    reps: [10, [Validators.required, Validators.min(1)]],
    weight: [20, [Validators.required, Validators.min(0)]]
  });

  ngOnInit(): void {
    const sessionUser = this.authService.snapshot?.user;
    this.userRoleId.set(this.resolveRoleId(sessionUser));

    if (this.isRole1()) {
      this.store.load();
      console.log(this.store.vm$);
      this.loadAdminData();
      this.subtitle.set('Administra las rutinas de entrenamiento ');
      this.meta.set('Entrenadores');
      return;
    }

    if (this.isRole2() && sessionUser?.id) {
      this.routinesApiService
        .getByUser(sessionUser.id)
        .pipe(take(1))
        .subscribe((routines) => {
          this.userRoutines.set(routines);
          this.subtitle.set('');
          this.meta.set('Trainee');
        });
    }
  }

  ngAfterViewInit(): void {
    if (this.route.snapshot.queryParamMap.get('new') === '1' && this.isRole1()) {
      setTimeout(() => this.openDialog(), 300);
      void this.router.navigate([], { queryParams: {} });
    }
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

  isRole1(): boolean {
    return this.userRoleId() === 1;
  }

  isRole2(): boolean {
    return this.userRoleId() === 2;
  }

  private loadAdminData(): void {
    const companyId = this.authService.snapshot?.user.idEmpresa;
    const usersRequest$ = companyId ? this.usersApiService.getByEmpresa(companyId) : this.usersApiService.getAll();
    usersRequest$
      .pipe(take(1))
      .subscribe((users) => this.users.set(users.filter((user) => user.idRol === 2)));

    this.exercisesApiService
      .getAll()
      .pipe(take(1))
      .subscribe((catalog) => this.exerciseCatalog.set(catalog));

    this.muscleGroupsApiService
      .getAll(companyId!!)
      .pipe(take(1))
      .subscribe((groups) => this.muscleGroupCatalog.set(groups));
  }

  setSelectedMuscleGroupId(value: number | 0): void {
    this.selectedMuscleGroupId.set(Number(value) || 0);
  }

  openCustomizedRoutineDialog(): void {
    const dialogRef = this.dialog.open(RoutineCustomizeDialogComponent, {
      width: '1880px',
      maxWidth: '100vw',
      maxHeight: '96vh',
      data: {
        users: this.users(),
        exercises: this.exerciseCatalog(),
        focusOptions: this.focusOptions,
        intensityOptions: this.intensityOptions
      }
    });
    // ... existing code ...
  }

  openQuickRoutineDialog(): void {
    const dialogRef = this.dialog.open(QuickRoutineDialogComponent, {
      width: window.matchMedia('(max-width: 960px)').matches ? '100vw' : '1400px',
      maxWidth: '100vw',
      maxHeight: '96vh',
      data: {
        exercises: this.exerciseCatalog(),
        focusOptions: this.focusOptions,
        intensityOptions: this.intensityOptions
      }
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe((result?: QuickRoutineResult) => {
      if (!result) return;

      const payload: Routine = {
        id: '0',
        name: result.name,
        description: `Rutina rápida: ${result.template}. ${result.focus ? `Foco: ${result.focus}. ` : ''}${result.intensity ? `Intensidad: ${result.intensity}.` : ''}`,
        isCustomized: false,
        exercises: result.exercises
      };

      this.routinesApiService
        .create(payload)
        .pipe(take(1))
        .subscribe(() => {
          this.store.load();
          this.toastr.success(`Rutina rápida "${result.name}" creada.`);
        });
    });
  }

  edit(routine: Routine): void {
    this.editingId.set(routine.id);
    this.form.patchValue({
      name: routine.name,
      description: routine.description
    });
    this.selectedExercises.set([...routine.exercises]);
    console.log(routine);
    this.openDialog();
  }

  openDialog(): void {
    const isMobile = window.innerWidth <= 720;
    this.dialogRef = this.dialog.open(this.formDialogRef, {
      width: isMobile ? '100vw' : '1120px',
      maxWidth: '100vw',
      panelClass: isMobile ? 'dialog-panel-mobile' : undefined
    });
    this.dialogRef.afterClosed().pipe(take(1)).subscribe(() => this.resetForm());
  }

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
        this.store
          .remove(routine.id)
          .pipe(take(1))
          .subscribe(() => this.toastr.success('Rutina eliminada.'));
      });
  }

  assignUser(routine: Routine): void {
    this.assignTargetRoutine.set(routine);
    this.selectedAssignUserId.set(null);
    const ref = this.dialog.open(this.assignUserDialogRef, { width: '420px' });
    ref.afterClosed().pipe(take(1)).subscribe((userId: string | undefined) => {
      if (!userId) return;
      const selectedUser = this.users().find((u) => String(u.id) === String(userId));
      if (!selectedUser) return;
      this.routinesApiService.createByUser(userId, routine).pipe(take(1)).subscribe(() => {
        this.toastr.success(`Rutina asignada a ${selectedUser.nombre}.`);
      });
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    var entrenadorId = this.authService.snapshot?.user.id ?? "";
    
    console.log(this.authService.snapshot?.user);
  //  return;
    const payload: Routine = {
      id: this.editingId() ?? "0",
      name: rawValue.name,
      description: rawValue.description,
      EntrenadorId: entrenadorId && entrenadorId.trim().length > 0 ? entrenadorId : undefined,
      exercises: [...this.selectedExercises()]
      
    };

    const request$ = this.editingId() ? this.store.update(payload) : this.store.create(payload);
    request$.pipe(take(1)).subscribe(() => {
      this.toastr.success(this.editingId() ? 'Rutina actualizada.' : 'Rutina creada.');
      this.dialogRef?.close();
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.selectedExercises.set([]);
    this.selectedMuscleGroupId.set(0);
    this.form.reset({
      name: '',
      description: ''
    });
    this.exerciseForm.reset({
      exerciseId: '',
      sets: 4,
      reps: 10,
      weight: 20
    });
    this.exerciseSearchControl.reset();
  }

  displayExerciseName(exercise?: ExerciseCatalogItem): string {
    return exercise ? exercise.name : '';
  }

  clearExerciseSearch(): void {
    this.exerciseSearchControl.reset();
    this.exerciseForm.patchValue({ exerciseId: '' });
  }

  onExerciseSelected(event: MatAutocompleteSelectedEvent): void {
    const exercise = event.option.value as ExerciseCatalogItem;
    this.exerciseForm.patchValue({ exerciseId: exercise.id });
  }

  addExerciseToRoutine(): void {
    if (this.exerciseForm.invalid) {
      this.exerciseForm.markAllAsTouched();
      const exerciseControl = this.exerciseForm.get('exerciseId');
      if (exerciseControl?.invalid) {
        this.notificationService.warning('Selecciona un ejercicio de la lista.');
      }
      return;
    }

    const rawValue = this.exerciseForm.getRawValue();
    const selected = this.exerciseCatalog().find((item) => item.id === rawValue.exerciseId);
    if (!selected) {
      return;
    }

    if (this.selectedExercises().some((e) => e.exerciseId === String(selected.id))) {
      this.notificationService.warning(`"${selected.name}" ya está agregado.`);
      return;
    }

    this.selectedExercises.update((current) => [
      ...current,
      {
        id: selected.id,
        exerciseId: selected.id,
        exerciseName: selected.name,
        exerciseDescription: selected.description,
        sets: rawValue.sets,
        reps: rawValue.reps,
        weight: rawValue.weight
      }
    ]);

    this.exerciseForm.patchValue({
      exerciseId: '',
      sets: 4,
      reps: 10,
      weight: 20
    });
    this.exerciseSearchControl.reset();
    this.partialSave();
  }

  removeExerciseFromRoutine(exerciseId: string): void {
    this.selectedExercises.update((current) => current.filter((item) => item.id !== exerciseId));
    this.partialSave();
  }

  private partialSave(): void {
    const editingId = this.editingId();
    if (!editingId) return;

    const rawValue = this.form.getRawValue();
    const entrenadorId = this.authService.snapshot?.user.id ?? '';

    const payload: Routine = {
      id: editingId,
      name: rawValue.name,
      description: rawValue.description,
      EntrenadorId: entrenadorId && entrenadorId.trim().length > 0 ? entrenadorId : undefined,
      exercises: [...this.selectedExercises()]
    };

    this.store.update(payload).pipe(take(1)).subscribe(() => {
      this.toastr.success('Ejercicios guardados.');
    });
  }

  getVisibleRoutines(data: Routine[]): Routine[] {
    return data.filter((routine) => !routine.isCustomized);
  }
}

@Component({
  selector: 'app-quick-routine-dialog',
  standalone: true,
imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <span>Rutina Rápida</span>
      <button mat-icon-button mat-dialog-close aria-label="Cerrar"><mat-icon>close</mat-icon></button>
    </h2>
    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="qr-form">
        <div class="card-surface form-subsection qr-info-card">
          <h3>Información de la rutina</h3>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Nombre de la rutina</mat-label>
            <input matInput formControlName="name" placeholder="Ej: Pecho - Push">
          </mat-form-field>

          <div class="row-3">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Foco</mat-label>
              <mat-select formControlName="focus">
                @for (f of focusOptions; track f) {
                  <mat-option [value]="f">{{ f }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Intensidad</mat-label>
              <mat-select formControlName="intensity">
                @for (i of intensityOptions; track i) {
                  <mat-option [value]="i">{{ i }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Grupo muscular</mat-label>
              <mat-select [formControl]="muscleGroupCtrl">
                <mat-option value="all">Todos</mat-option>
                @for (g of muscleGroups(); track g) {
                  <mat-option [value]="g">{{ g }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <div class="card-surface form-subsection qr-generate-card">
          <h3>Generar</h3>
          <div class="qr-generate-row">
            <mat-form-field appearance="outline" class="qr-count-field">
              <mat-label>Cantidad</mat-label>
              <input matInput type="number" [formControl]="countCtrl" min="1" max="50">
            </mat-form-field>
            <button mat-flat-button color="primary" type="button" (click)="generateExercises()" [disabled]="generating()" class="full-width">
              <mat-icon>auto_awesome</mat-icon>
              {{ generating() ? 'Generando...' : 'Generar ejercicios' }}
            </button>
          </div>
        </div>

        <div class="card-surface form-subsection qr-exercises-card">
          <h3>Ejercicios ({{ exercises().length }})</h3>

          @if (exercises().length === 0) {
            <p class="empty-exercises-msg">Selecciona un grupo y pulsa Generar.</p>
          } @else {
            <div class="qr-table-wrap">
              <table mat-table [dataSource]="exercises()" class="qr-table">
              <ng-container matColumnDef="exerciseName">
                <th mat-header-cell *matHeaderCellDef>Ejercicio</th>
                <td mat-cell *matCellDef="let ex">{{ ex.exerciseName }}</td>
              </ng-container>
              <ng-container matColumnDef="sets">
                <th mat-header-cell *matHeaderCellDef>Series</th>
                <td mat-cell *matCellDef="let ex">
                  <input class="qr-cell-input" type="number" min="1" max="20"
                    [value]="ex.sets" (change)="updateExercise(ex.id, 'sets', $event)" />
                </td>
              </ng-container>
              <ng-container matColumnDef="reps">
                <th mat-header-cell *matHeaderCellDef>Reps</th>
                <td mat-cell *matCellDef="let ex">
                  <input class="qr-cell-input" type="number" min="1" max="100"
                    [value]="ex.reps" (change)="updateExercise(ex.id, 'reps', $event)" />
                </td>
              </ng-container>
              <ng-container matColumnDef="weight">
                <th mat-header-cell *matHeaderCellDef>Kg</th>
                <td mat-cell *matCellDef="let ex">
                  <input class="qr-cell-input" type="number" min="0" max="500"
                    [value]="ex.weight" (change)="updateExercise(ex.id, 'weight', $event)" />
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let ex">
                  <button mat-icon-button type="button" (click)="removeExercise(ex.id)" matTooltip="Quitar">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
              </table>
            </div>
          }
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || exercises().length === 0" (click)="confirm()" cdkFocusInitial>
        Crear rutina
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content {
      max-height: 70vh;
      overflow-y: auto;
      padding-top: 0.9rem;
      background: var(--surface-raised);
    }
    .qr-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.35rem 0.75rem;
      padding: 0 0.5rem;
      align-items: start;
    }
    .qr-form .full-span {
      grid-column: 1 / -1;
    }
    /* Web: info + generar a la izquierda, ejercicios a la derecha */
    @media (min-width: 961px) {
      .qr-info-card {
        grid-column: 1;
        grid-row: 1;
      }
      .qr-generate-card {
        grid-column: 1;
        grid-row: 2;
      }
      .qr-exercises-card {
        grid-column: 2;
        grid-row: 1 / span 2;
      }
    }
    .qr-form .card-surface {
      padding: 0.9rem;
      border: 1px solid var(--border);
      background: var(--surface-raised);
    }
    .qr-form .card-surface h3 {
      margin: 0 0 0.6rem;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .full-width {
      width: 100%;
      grid-column: 1 / -1;
    }
    .row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }
    .row-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.5rem;
    }
    .qr-generate-row {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 0.75rem;
      align-items: end;
    }
    .qr-count-field {
      width: 100%;
    }
    .qr-table-wrap {
      width: 100%;
      max-width: 100%;
      max-height: 52vh;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: var(--cut);
      border: 1px solid var(--border);
    }
    .qr-table {
      width: 100%;
      min-width: 360px;
      font-size: 0.85rem;
    }
    .qr-cell-input {
      width: 100%;
      max-width: 62px;
      padding: 4px 6px;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: var(--surface-sunken);
      color: var(--app-text);
      font-size: 0.82rem;
      font-weight: 600;
      text-align: center;
      box-sizing: border-box;
    }
    .qr-cell-input:focus {
      outline: none;
      border-color: var(--brand-yellow);
      background: var(--surface-raised);
    }
    .empty-exercises-msg {
      text-align: center;
      color: var(--app-text-soft);
      font-size: 0.9rem;
      padding: 1.5rem 0;
      margin: 0;
    }
    .flex-1 {
      flex: 1;
      min-width: 220px;
    }
    @media (max-width: 960px) {
      .qr-form {
        grid-template-columns: 1fr;
      }
      .row-2,
      .row-3 {
        grid-template-columns: 1fr;
      }
      .qr-generate-row {
        grid-template-columns: 120px 1fr;
      }
      .dialog-content {
        padding-left: 0.6rem;
        padding-right: 0.6rem;
      }
      .qr-form {
        padding: 0;
      }
      .qr-form .card-surface {
        padding: 0.7rem;
      }
      .qr-table {
        min-width: 320px;
        font-size: 0.8rem;
      }
      :host ::ng-deep .qr-table .mat-column-sets,
      :host ::ng-deep .qr-table .mat-column-reps,
      :host ::ng-deep .qr-table .mat-column-weight {
        width: 56px;
      }
      .qr-cell-input {
        max-width: 48px;
        padding: 3px 4px;
        font-size: 0.78rem;
      }
    }
    :host ::ng-deep mat-dialog-actions {
      background: var(--surface-raised);
      border-top: 1px solid var(--border);
      padding: 0.75rem 1rem 1rem;
    }
    :host ::ng-deep .qr-table {
      font-size: 0.85rem;
    }
    :host ::ng-deep .qr-table .mat-header-cell,
    :host ::ng-deep .qr-table .mat-cell {
      padding: 5px 6px !important;
      font-size: 0.82rem !important;
    }
    :host ::ng-deep .qr-table .mat-column-sets,
    :host ::ng-deep .qr-table .mat-column-reps,
    :host ::ng-deep .qr-table .mat-column-weight,
    :host ::ng-deep .qr-table .mat-column-actions {
      width: 68px;
      text-align: center;
      padding-left: 2px !important;
      padding-right: 2px !important;
    }
    :host ::ng-deep .qr-table .mat-column-actions {
      width: 44px;
    }
  `]
})
export class QuickRoutineDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<QuickRoutineDialogComponent, QuickRoutineResult>);
  readonly data = inject<{ exercises: ExerciseCatalogItem[]; focusOptions: string[]; intensityOptions: string[] }>(MAT_DIALOG_DATA);

  readonly focusOptions = this.data.focusOptions;
  readonly intensityOptions = this.data.intensityOptions;
  readonly exercises = signal<RoutineExercise[]>([]);
  readonly displayedColumns = ['exerciseName', 'sets', 'reps', 'weight', 'actions'];
  readonly generating = signal(false);

  readonly muscleGroups = computed(() => {
    const groups = new Set(this.data.exercises.map(e => this.getGroupLabel(e)).filter(Boolean));
    return Array.from(groups).sort();
  });

  readonly muscleGroupCtrl = new FormControl<string>('all');
  readonly countCtrl = new FormControl<number>(10, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(1), Validators.max(50)],
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    focus: [''],
    intensity: ['']
  });

  private getGroupLabel(ex: ExerciseCatalogItem): string {
    const name = ex.name.toLowerCase();
    if (name.includes('pecho') || name.includes('chest') || name.includes('press') || name.includes('fly') || name.includes('apertura')) return 'Pecho';
    if (name.includes('espalda') || name.includes('back') || name.includes('dorsal') || name.includes('pull') || name.includes('remo') || name.includes('dominada') || name.includes('jalón')) return 'Espalda';
    if (name.includes('hombro') || name.includes('shoulder') || name.includes('deltoides') || name.includes('press militar') || name.includes('elevación lateral') || name.includes('arnold')) return 'Hombro';
    if (name.includes('bíceps') || name.includes('bicep') || name.includes('curl') && (name.includes('bicep') || name.includes('martillo'))) return 'Bíceps';
    if (name.includes('tríceps') || name.includes('tricep') || name.includes('extensión') && name.includes('tríceps') || name.includes('dips') || name.includes('pushdown')) return 'Tríceps';
    if (name.includes('cuádriceps') || name.includes('quad') || name.includes('sentadilla') || name.includes('squat') || name.includes('prensa') || name.includes('zancada') || name.includes('lunge') || name.includes('extensión de pierna')) return 'Pierna (Cuádriceps)';
    if (name.includes('femoral') || name.includes('hamstring') || name.includes('curl femoral') || name.includes('peso muerto') || name.includes('deadlift') || name.includes('hip thrust')) return 'Pierna (Femoral/Glúteo)';
    if (name.includes('gemelo') || name.includes('calf') || name.includes('pantorrilla')) return 'Gemelos';
    if (name.includes('abdominal') || name.includes('core') || name.includes('crunch') || name.includes('plancha') || name.includes('plank') || name.includes('leg raise')) return 'Core';
    return 'Otros';
  }

  generateExercises(): void {
    const group = this.muscleGroupCtrl.value;
    if (!group || this.generating()) return;

    if (this.countCtrl.invalid) {
      this.countCtrl.markAsTouched();
      return;
    }

    const requested = Math.floor(Number(this.countCtrl.value) || 10);

    this.generating.set(true);
    const pool = this.data.exercises.filter(e => group === 'all' || this.getGroupLabel(e) === group);
    if (!pool.length) {
      this.generating.set(false);
      return;
    }

    // Mezclar y tomar según la cantidad solicitada
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, requested);

    const defaultsByGroup: Record<string, { sets: number; reps: number; weight: number }> = {
      'Pecho': { sets: 4, reps: 10, weight: 20 },
      'Espalda': { sets: 4, reps: 10, weight: 25 },
      'Hombro': { sets: 3, reps: 12, weight: 12 },
      'Bíceps': { sets: 3, reps: 12, weight: 10 },
      'Tríceps': { sets: 3, reps: 12, weight: 10 },
      'Pierna (Cuádriceps)': { sets: 4, reps: 10, weight: 40 },
      'Pierna (Femoral/Glúteo)': { sets: 4, reps: 10, weight: 35 },
      'Gemelos': { sets: 4, reps: 15, weight: 20 },
      'Core': { sets: 3, reps: 15, weight: 0 },
      'Otros': { sets: 3, reps: 12, weight: 15 }
    };

    const intensity = this.form.getRawValue().intensity;
    const weightDelta = this.getIntensityWeightDelta(intensity);

    const newExercises = selected.map(ex => {
      const def = defaultsByGroup[this.getGroupLabel(ex)] ?? defaultsByGroup['Otros'];
      return {
        id: crypto.randomUUID(),
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: def.sets,
        reps: def.reps,
        weight: Math.max(0, def.weight + weightDelta),
        isFinished: false
      };
    });

    // Reemplaza la lista: cada generación es una rutina nueva para el grupo elegido
    this.exercises.set(newExercises);
    this.generating.set(false);
  }

  /** Baja resta 5kg, Media mantiene el base, Alta suma 5kg. */
  private getIntensityWeightDelta(intensity?: string): number {
    switch (intensity) {
      case 'Baja': return -5;
      case 'Media': return 0;
      case 'Alta': return 5;
      default: return 0;
    }
  }

  removeExercise(id: string): void {
    this.exercises.update(arr => arr.filter(e => e.id !== id));
  }

  /** Actualiza series/reps/peso de un ejercicio desde los inputs de la tabla. */
  updateExercise(id: string, field: 'sets' | 'reps' | 'weight', event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = Number(input.value);
    const fallback = this.exercises().find(e => e.id === id)?.[field] ?? 0;
    const value = Number.isFinite(raw) ? Math.trunc(raw) : fallback;

    this.exercises.update(arr =>
      arr.map(e => (e.id === id ? { ...e, [field]: value } : e)),
    );
    input.value = String(value);
  }

  confirm(): void {
    if (this.form.invalid || this.exercises().length === 0) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({
      name: v.name,
      template: 'Generada por grupo',
      focus: v.focus,
      intensity: v.intensity,
      exercises: this.exercises()
    });
  }
}