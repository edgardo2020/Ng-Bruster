import { Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { ToastrService } from 'ngx-toastr';

import { FoodCatalogItem, UserNutritionPlan } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { AskDialogComponent } from '../../../shared/ui/ask-dialog.component';
import { FoodsApiService } from '../data-access/foods-api.service';
import { UserNutritionPlansApiService } from '../../users/data-access/user-nutrition-plans-api.service';

@Component({
  selector: 'app-foods-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTableModule,
    PageHeaderComponent
  ],
  templateUrl: './foods.page.html',
  styleUrl: './foods.page.scss'
})
export class FoodsPageComponent implements OnInit {
  @ViewChild('formDialog') private formDialogRef!: TemplateRef<unknown>;

  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly foodsApiService = inject(FoodsApiService);
  private readonly userNutritionPlansApiService = inject(UserNutritionPlansApiService);
  private dialogRef: MatDialogRef<unknown> | null = null;
  private readonly dateFormatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  readonly foods = signal<FoodCatalogItem[]>([]);
  readonly userPlans = signal<UserNutritionPlan[]>([]);
  readonly userRoleId = signal<number | null>(null);
  readonly editingId = signal<number | null>(null);
  readonly displayedColumns = ['name', 'category', 'serving', 'calories', 'macros', 'active', 'actions'];

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    category: ['', Validators.required],
    serving: ['100 g', Validators.required],
    calories: [0, [Validators.required, Validators.min(0)]],
    protein: [0, [Validators.required, Validators.min(0)]],
    carbs: [0, [Validators.required, Validators.min(0)]],
    fats: [0, [Validators.required, Validators.min(0)]],
    active: [true]
  });

  ngOnInit(): void {
    const sessionUser = this.authService.snapshot?.user;
    this.userRoleId.set(this.resolveRoleId(sessionUser));

    if (this.isRole2() && sessionUser?.id) {
      this.loadUserPlans(sessionUser.id);
      return;
    }

    this.loadFoods();
  }

  isRole1(): boolean {
    return this.userRoleId() === 1;
  }

  isRole2(): boolean {
    return this.userRoleId() === 2;
  }

  formatFriendlyDate(value?: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '-';
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return this.dateFormatter.format(parsed);
    }

    const datePart = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (datePart) {
      const fallbackDate = new Date(`${datePart}T00:00:00`);
      if (!Number.isNaN(fallbackDate.getTime())) {
        return this.dateFormatter.format(fallbackDate);
      }
    }

    return raw;
  }

  openDialog(): void {
    this.dialogRef = this.dialog.open(this.formDialogRef, { width: '900px', maxWidth: '96vw' });
    this.dialogRef.afterClosed().pipe(take(1)).subscribe(() => this.resetForm());
  }

  edit(food: FoodCatalogItem): void {
    this.editingId.set(food.id);
    this.form.patchValue({
      name: food.name,
      category: food.category,
      serving: food.serving,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fats: food.fats,
      active: food.active ?? true
    });
    this.openDialog();
  }

  remove(food: FoodCatalogItem): void {
    this.dialog
      .open(AskDialogComponent, {
        data: {
          title: 'Confirmar eliminacion',
          message: `¿Eliminar alimento ${food.name}?`
        }
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((ok) => {
        if (!ok) {
          return;
        }

        this.foodsApiService.remove(food.id).pipe(take(1)).subscribe(() => {
          this.loadFoods();
        });
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: Omit<FoodCatalogItem, 'id'> = {
      name: raw.name,
      category: raw.category,
      serving: raw.serving,
      calories: Number(raw.calories),
      protein: Number(raw.protein),
      carbs: Number(raw.carbs),
      fats: Number(raw.fats),
      active: raw.active
    };

    const request$ = this.editingId()
      ? this.foodsApiService.update({ id: this.editingId() as number, ...payload })
      : this.foodsApiService.create(payload);

    request$.pipe(take(1)).subscribe(() => {
      this.loadFoods();
      this.dialogRef?.close();
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      category: '',
      serving: '100 g',
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      active: true
    });
  }

  private loadFoods(): void {
    this.foodsApiService.getAll().pipe(take(1)).subscribe({
      next: (foods) => this.foods.set(foods),
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudo cargar el catalogo de comidas.'));
      }
    });
  }

  private loadUserPlans(userId: string): void {
    this.userNutritionPlansApiService.getByUser(userId).pipe(take(1)).subscribe({
      next: (plans) => this.userPlans.set(plans),
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudieron cargar tus planes de alimentacion.'));
      }
    });
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

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    return fallback;
  }
}
