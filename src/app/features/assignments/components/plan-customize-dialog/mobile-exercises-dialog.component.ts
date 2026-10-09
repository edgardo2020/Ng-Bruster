import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ExerciseCatalogItem, MuscleGroupCatalogItem } from '../../../../core/models/gym.models';

export interface MobileExercisesDialogData {
  title: string;
  exercises: ExerciseCatalogItem[];
  muscleGroups: MuscleGroupCatalogItem[];
}

@Component({
  selector: 'app-mobile-exercises-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <h2 mat-dialog-title class="mobile-ex-title">
      <span>{{ data.title }}</span>
      <button mat-icon-button mat-dialog-close type="button" aria-label="Cerrar">
        <mat-icon>close</mat-icon>
      </button>
    </h2>
    <mat-dialog-content class="mobile-ex-content">
      <mat-form-field appearance="outline" class="mobile-ex-search" subscriptSizing="dynamic">
        <mat-label>Buscar ejercicio</mat-label>
        <input matInput [value]="search()" (input)="search.set($any($event.target).value)" />
        @if (search()) {
          <button mat-icon-button matSuffix type="button" aria-label="Limpiar" (click)="search.set('')">
            <mat-icon>close</mat-icon>
          </button>
        }
      </mat-form-field>
      <mat-form-field appearance="outline" class="mobile-ex-search" subscriptSizing="dynamic">
        <mat-label>Grupo muscular</mat-label>
        <mat-select [value]="muscleGroup()" (valueChange)="muscleGroup.set($event)">
          <mat-option value="all">Todos</mat-option>
          @for (group of data.muscleGroups; track group.id) {
            <mat-option [value]="group.id">{{ group.description }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <div class="mobile-ex-list">
        @for (exercise of filtered(); track exercise.id) {
          <div class="mobile-ex-item">
            <div class="mobile-ex-info">
              <strong>{{ exercise.name }}</strong>
              @if (exercise.description) {
                <p>{{ exercise.description }}</p>
              }
              @if (exercise.muscleGroupCatalog?.description) {
                <span class="mobile-ex-chip">{{ exercise.muscleGroupCatalog?.description }}</span>
              }
            </div>
            <button
              mat-icon-button
              type="button"
              class="mobile-ex-add"
              aria-label="Agregar {{ exercise.name }}"
              (click)="dialogRef.close(exercise)"
            >
              <mat-icon>add</mat-icon>
            </button>
          </div>
        } @empty {
          <div class="empty-state compact">Sin resultados.</div>
        }
      </div>
    </mat-dialog-content>
  `,
  styles: [`
    .mobile-ex-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0;
      padding: 0.8rem 1rem;
      background: var(--mat-sys-primary, #272727);
      color: var(--mat-sys-on-primary, #ffffff);
      border-bottom: 1px solid color-mix(in srgb, var(--mat-sys-primary, #272727) 80%, black);
    }
    .mobile-ex-title span {
      font-weight: 600;
      font-size: 1.04rem;
      letter-spacing: 0.01em;
    }
    .mobile-ex-title button {
      color: var(--mat-sys-on-primary, #ffffff);
    }
    .mobile-ex-content {
      display: grid;
      gap: 0.5rem;
      padding-top: 0.5rem !important;
    }
    .mobile-ex-search {
      width: 100%;
    }
    .mobile-ex-list {
      display: grid;
      gap: 0.4rem;
      max-height: 50vh;
      overflow-y: auto;
    }
    .mobile-ex-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.6rem;
      border: 1px solid var(--app-border);
      border-radius: 3px;
      background: var(--app-surface);
    }
    .mobile-ex-info {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 0.15rem;
    }
    .mobile-ex-info strong {
      font-size: 0.85rem;
      color: var(--app-text);
    }
    .mobile-ex-info p {
      margin: 0;
      font-size: 0.72rem;
      color: var(--app-text-soft);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .mobile-ex-chip {
      width: fit-content;
      padding: 0.1rem 0.45rem;
      font-size: 0.65rem;
      font-weight: 600;
      border-radius: 3px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      color: var(--app-text-soft);
    }
    .mobile-ex-add {
      flex: 0 0 auto;
      color: #111;
      background: var(--app-primary);
    }
  `]
})
export class MobileExercisesDialogComponent {
  readonly dialogRef = inject(MatDialogRef<MobileExercisesDialogComponent, ExerciseCatalogItem>);
  readonly data = inject<MobileExercisesDialogData>(MAT_DIALOG_DATA);
  readonly search = signal('');
  readonly muscleGroup = signal<number | 'all'>('all');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const group = this.muscleGroup();
    return this.data.exercises.filter((exercise) => {
      const matchesText =
        !term ||
        exercise.name.toLowerCase().includes(term) ||
        (exercise.description ?? '').toLowerCase().includes(term);
      const matchesGroup =
        group === 'all' ||
        exercise.muscleGroupCatalogId === group ||
        exercise.muscleGroupCatalog?.id === group;
      return matchesText && matchesGroup;
    });
  });
}
