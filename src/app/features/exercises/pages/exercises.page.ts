import { AsyncPipe } from '@angular/common';
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

import { ExerciseCatalogItem, MuscleGroup, MuscleGroupCatalogItem } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { AskDialogComponent } from '../../../shared/ui/ask-dialog.component';
import { MuscleGroupsApiService } from '../data-access/muscle-groups-api.service';
import { ExercisesStore } from '../data-access/exercises.store';

type MuscleGroupSummaryItem = {
  id: number;
  description: string;
  count: number;
};

type MuscleGroupOption = {
  id: number;
  description: string;
};

const MUSCLE_GROUP_BY_ID: Record<number, MuscleGroup> = {
  1: 'Chest',
  2: 'Back',
  3: 'Shoulders',
  4: 'Arms',
  5: 'Legs',
  6: 'Core',
  7: 'FullBody',
  8: 'Cardio'
};

const MUSCLE_GROUP_ID_BY_NAME: Record<MuscleGroup, number> = {
  Chest: 1,
  Back: 2,
  Shoulders: 3,
  Arms: 4,
  Legs: 5,
  Core: 6,
  FullBody: 7,
  Cardio: 8
};

@Component({
  selector: 'app-exercises-page',
  standalone: true,
  imports: [
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
    MatDialogModule,
    AskDialogComponent
  ],
  templateUrl: './exercises.page.html',
  styleUrl: './exercises.page.scss'
})
export class ExercisesPageComponent implements OnInit {
  @ViewChild('formDialog') private formDialogRef!: TemplateRef<unknown>;
  @ViewChild('muscleGroupDialog') private muscleGroupDialogRef!: TemplateRef<unknown>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly muscleGroupsApiService = inject(MuscleGroupsApiService);
  private dialogRef: MatDialogRef<unknown> | null = null;

  readonly store = inject(ExercisesStore);
  readonly editingId = signal<string | null>(null);
  readonly muscleGroupEditingId = signal<number | null>(null);
  readonly selectedMuscleGroupId = signal<number | 0>(0);
  readonly selectedImageBase64 = signal<string | null>(null);
  readonly selectedImageName = signal<string | null>(null);
  readonly editingMediaUrl = signal<string | null>(null);
  readonly displayedColumns = ['name', 'muscleGroup', 'actions'];
  readonly muscleGroupDisplayedColumns = ['description', 'count', 'actions'];
  readonly muscleGroupCatalog = signal<MuscleGroupCatalogItem[]>([]);
  readonly muscleGroupsCollapsed = signal(false);
  readonly selectedGroupTitle = computed(() => {
    const id = this.selectedMuscleGroupId();
    if (!id) return 'Catalogo de ejercicios';
    const group = this.muscleGroupCatalog().find((g) => g.id === id);
    return group ? `Ejercicios de ${group.description}` : 'Catalogo de ejercicios';
  });

  toggleMuscleGroups(): void {
    this.muscleGroupsCollapsed.update((v) => !v);
  }

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    muscleGroupId: [0, Validators.required]
  });

  readonly muscleGroupForm = this.formBuilder.nonNullable.group({
    description: ['', Validators.required]
  });

  ngOnInit(): void {
    this.store.load();
    this.loadMuscleGroups();
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? result;
      this.selectedImageBase64.set(base64);
      this.selectedImageName.set(file.name);
    };
    reader.readAsDataURL(file);
  }

  edit(exercise: ExerciseCatalogItem): void {
    //console.log('Editing exercise:', exercise);
    this.editingId.set(exercise.id);
    this.selectedImageBase64.set(null);
    this.selectedImageName.set(null);
    this.editingMediaUrl.set(exercise.ImageBase64 ? `data:image/*;base64,${exercise.ImageBase64}` : null);
    this.form.patchValue({
      name: exercise.name,
      description: exercise.description,
      muscleGroupId: this.resolveExerciseMuscleGroupId(exercise)
    });
    this.openDialog();
  }

  openDialog(): void {
    if (!this.editingId() && this.selectedMuscleGroupId()) {
      this.form.patchValue({ muscleGroupId: this.selectedMuscleGroupId() });
    }
    this.dialogRef = this.dialog.open(this.formDialogRef, { width: '720px', maxWidth: '92vw' });
    this.dialogRef.afterClosed().pipe(take(1)).subscribe(() => this.resetForm());
  }

  openMuscleGroupDialog(): void {
    this.dialogRef = this.dialog.open(this.muscleGroupDialogRef, { width: '520px', maxWidth: '92vw' });
    this.dialogRef.afterClosed().pipe(take(1)).subscribe(() => this.resetMuscleGroupForm());
  }

  remove(exercise: ExerciseCatalogItem): void {
    this.dialog
      .open(AskDialogComponent, {
        data: {
          message: `¿Eliminar el ejercicio ${exercise.name}?`,
          title: 'Confirmar eliminación'
        }
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe(result => {
        if (!result) return;
        this.store
          .remove(exercise.id)
          .pipe(take(1))
          .subscribe({
            next: () => this.toastr.success('Ejercicio eliminado.'),
            error: (error: unknown) => {
              this.toastr.error(this.getErrorMessage(error, 'No se pudo eliminar el ejercicio.'));
            }
          });
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const normalizedMuscleGroupId = this.isCatalogGroupId(rawValue.muscleGroupId)
      ? rawValue.muscleGroupId
      : this.resolveDefaultMuscleGroupId();
    const muscleGroup = MUSCLE_GROUP_BY_ID[normalizedMuscleGroupId] ?? this.resolveDefaultMuscleGroup();

    const payload: ExerciseCatalogItem = {
      id: this.editingId() ??"0",
      name: rawValue.name,
      description: rawValue.description,
      muscleGroup,
      muscleGroupCatalogId: normalizedMuscleGroupId,
      ...(this.selectedImageBase64() ? { ImageBase64: this.selectedImageBase64()! } : {})
    };

    const request$ = this.editingId() ? this.store.update(payload) : this.store.create(payload);
    request$.pipe(take(1)).subscribe({
      next: () => {
        this.toastr.success(this.editingId() ? 'Ejercicio actualizado.' : 'Ejercicio creado.');
        this.dialogRef?.close();
      },
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudo guardar el ejercicio.'));
      }
    });
  }

  clearImage(): void {
    this.selectedImageBase64.set(null);
    this.selectedImageName.set(null);
    this.editingMediaUrl.set(null);
  }

  resetForm(): void {
    this.editingId.set(null);
    this.selectedImageBase64.set(null);
    this.selectedImageName.set(null);
    this.editingMediaUrl.set(null);
    const defaultMuscleGroupId = this.resolveDefaultMuscleGroupId();
    this.form.reset({
      name: '',
      description: '',
      muscleGroupId: defaultMuscleGroupId
    });
  }

  editMuscleGroup(muscleGroup: MuscleGroupCatalogItem): void {
    this.muscleGroupEditingId.set(muscleGroup.id);
    this.muscleGroupForm.patchValue({ description: muscleGroup.description });
    this.openMuscleGroupDialog();
  }

  removeMuscleGroup(muscleGroup: MuscleGroupSummaryItem): void {
    if (muscleGroup.count > 0) {
      this.toastr.info('No se puede eliminar el grupo muscular mientras tenga ejercicios registrados.');
      return;
    }

    this.dialog
      .open(AskDialogComponent, {
        data: {
          message: `¿Eliminar grupo muscular ${muscleGroup.description}?`,
          title: 'Confirmar eliminación'
        }
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe(result => {
        if (!result) return;
        this.muscleGroupsApiService
          .remove(muscleGroup.id)
          .pipe(take(1))
          .subscribe({
            next: () => {
              this.toastr.success('Grupo muscular eliminado.');
              this.loadMuscleGroups();
              if (this.selectedMuscleGroupId() === muscleGroup.id) {
                this.selectMuscleGroup(0);
              }
            },
            error: (error: unknown) => {
              this.toastr.error(this.getErrorMessage(error, 'No se pudo eliminar el grupo muscular.'));
            }
          });
      });
  }

  saveMuscleGroup(): void {
    if (this.muscleGroupForm.invalid) {
      this.muscleGroupForm.markAllAsTouched();
      return;
    }

    const payload: MuscleGroupCatalogItem = {
      id: this.muscleGroupEditingId() ?? 0,
      description: this.muscleGroupForm.controls.description.value.trim()
    };

    const companyId = this.authService.snapshot?.user.idEmpresa;

    const request$ = this.muscleGroupEditingId()
      ? this.muscleGroupsApiService.update(payload)
      : this.muscleGroupsApiService.create(payload, companyId);

    request$.pipe(take(1)).subscribe({
      next: () => {
        this.toastr.success(this.muscleGroupEditingId() ? 'Grupo muscular actualizado.' : 'Grupo muscular creado.');
        this.loadMuscleGroups();
        this.dialogRef?.close();
      },
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudo guardar el grupo muscular.'));
      }
    });
  }

  startCreateMuscleGroup(): void {
    this.resetMuscleGroupForm();
    this.openMuscleGroupDialog();
  }

  selectMuscleGroup(muscleGroupId: number | 0): void {
    this.selectedMuscleGroupId.set(muscleGroupId);
  }

  getFilteredExercises(exercises: ExerciseCatalogItem[] | null | undefined): ExerciseCatalogItem[] {
    if (!Array.isArray(exercises)) {
      return [];
    }

    const selectedMuscleGroupId = this.selectedMuscleGroupId();
    if (selectedMuscleGroupId === 0) {
      return exercises;
    }

    return exercises.filter((exercise) => this.resolveExerciseMuscleGroupId(exercise) === selectedMuscleGroupId);
  }

  getMuscleGroupSummary(exercises: ExerciseCatalogItem[] | null | undefined): MuscleGroupSummaryItem[] {
    const source = Array.isArray(exercises) ? exercises : [];

    const totals = source.reduce<Record<number, number>>((accumulator, exercise) => {
      const muscleGroupId = this.resolveExerciseMuscleGroupId(exercise);
      accumulator[muscleGroupId] = (accumulator[muscleGroupId] ?? 0) + 1;
      return accumulator;
    }, {} as Record<number, number>);

    return this.muscleGroupCatalog().map((group) => {
      return {
        id: group.id,
        description: group.description,
        count: totals[group.id] ?? 0
      };
    }).sort((left, right) => right.count - left.count);
  }

  getExerciseMuscleGroupDescription(exercise: ExerciseCatalogItem): string {
    const directDescription = exercise.muscleGroupCatalog?.description?.trim();
    if (directDescription) {
      return directDescription;
    }

    const muscleGroupId = this.resolveExerciseMuscleGroupId(exercise);
    const groupDescription = this.muscleGroupCatalog().find((group) => group.id === muscleGroupId)?.description;
    return groupDescription ?? 'Sin grupo';
  }

  getMuscleGroupOptions(): MuscleGroupOption[] {
    return this.muscleGroupCatalog().map((group) => ({
      id: group.id,
      description: group.description
    }));
  }

  private loadMuscleGroups(): void {
    const companyId = this.authService.snapshot?.user.idEmpresa;

    this.muscleGroupsApiService
      .getAll(companyId)
      .pipe(take(1))
      .subscribe({
        next: (groups) => this.muscleGroupCatalog.set([...groups].sort((left, right) => left.id - right.id)),
        error: (error: unknown) => {
          this.toastr.error(this.getErrorMessage(error, 'No se pudo cargar el catalogo de grupos musculares.'));
          this.muscleGroupCatalog.set([]);
        }
      });
  }

  private resetMuscleGroupForm(): void {
    this.muscleGroupEditingId.set(null);
    this.muscleGroupForm.reset({ description: '' });
  }

  private getErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallbackMessage;
  }

  private resolveDefaultMuscleGroupId(): number {
    const firstOption = this.getMuscleGroupOptions()[0];
    return firstOption?.id ?? 0;
  }

  private resolveDefaultMuscleGroup(): MuscleGroup {
    return MUSCLE_GROUP_BY_ID[this.resolveDefaultMuscleGroupId()] ?? 'Chest';
  }

  private resolveExerciseMuscleGroupId(exercise: ExerciseCatalogItem): number {
    const catalogId = Number(exercise.muscleGroupCatalog?.id ?? exercise.muscleGroupCatalogId ?? 0);
    if (catalogId > 0) {
      return catalogId;
    }

    return MUSCLE_GROUP_ID_BY_NAME[exercise.muscleGroup] ?? 0;
  }

  private isCatalogGroupId(muscleGroupId: number): boolean {
    return muscleGroupId > 0 && this.muscleGroupCatalog().some((group) => group.id === muscleGroupId);
  }
}
