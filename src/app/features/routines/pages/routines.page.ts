import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { ExerciseCatalogItem, MuscleGroupCatalogItem, Routine, RoutineExercise, UserRecord } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { AskDialogComponent } from '../../../shared/ui/ask-dialog.component';
import { ExercisesApiService } from '../../exercises/data-access/exercises-api.service';
import { MuscleGroupsApiService } from '../../exercises/data-access/muscle-groups-api.service';
import {
  RoutineCustomizeDialogComponent,
  RoutineCustomizeDialogResult
} from '../components/routine-customize-dialog/routine-customize-dialog.component';
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

  private readonly formBuilder = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);
  private readonly exercisesApiService = inject(ExercisesApiService);
  private readonly muscleGroupsApiService = inject(MuscleGroupsApiService);
  private readonly usersApiService = inject(UsersApiService);
  private readonly routinesApiService = inject(RoutinesApiService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private dialogRef: MatDialogRef<unknown> | null = null;

  readonly store = inject(RoutinesStore);
  readonly editingId = signal<string | null>(null);
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
  readonly filteredExerciseCatalog = computed(() => {
    const selectedGroupId = this.selectedMuscleGroupId();
    if (selectedGroupId === 0) {
      return this.exerciseCatalog();
    }

    return this.exerciseCatalog().filter((exercise) => {
      const muscleGroupId = exercise.muscleGroupCatalogId ?? exercise.muscleGroupCatalog?.id ?? 0;
      return muscleGroupId === selectedGroupId;
    });
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

    dialogRef.afterClosed().pipe(take(1)).subscribe((result?: RoutineCustomizeDialogResult) => {
      if (!result) {
        return;
      }

      const selectedUser = this.users().find((user) => String(user.id) === String(result.userId));
      if (!selectedUser) {
        this.toastr.error('Selecciona un usuario válido para generar la rutina personalizada.');
        return;
      }

      if (!result.selectedExercises.length) {
        this.toastr.error('Debes agregar al menos un ejercicio para generar la rutina personalizada.');
        return;
      }

      const routineName = result.routineName.trim() || `RUTINA PERSONALIZADA ${selectedUser.nombre}`;
      const notesFragment = result.notes?.trim() ? ` ${result.notes.trim()}` : '';
      const payload: Routine = {
        id: '0',
        name: routineName,
        description: `Rutina personalizada para ${selectedUser.nombre}. Objetivo: ${result.focus}. Intensidad: ${result.intensity}.${notesFragment}`,
        isCustomized: false,
        exercises: result.selectedExercises
      };

      this.routinesApiService
        .createByUser(selectedUser.id, payload)
        .pipe(take(1))
        .subscribe(() => {
          this.store.load();
          this.toastr.success(`Rutina personalizada creada para ${selectedUser.nombre}.`);
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
    this.openDialog();
  }

  openDialog(): void {
    this.dialogRef = this.dialog.open(this.formDialogRef, { width: '1120px', maxWidth: '96vw' });
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
  }

  addExerciseToRoutine(): void {
    if (this.exerciseForm.invalid) {
      this.exerciseForm.markAllAsTouched();
      return;
    }

    const rawValue = this.exerciseForm.getRawValue();
    const selected = this.exerciseCatalog().find((item) => item.id === rawValue.exerciseId);
    if (!selected) {
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
  }

  removeExerciseFromRoutine(exerciseId: string): void {
    this.selectedExercises.update((current) => current.filter((item) => item.id !== exerciseId));
  }

  getVisibleRoutines(data: Routine[]): Routine[] {
    return data.filter((routine) => !routine.isCustomized);
  }
}