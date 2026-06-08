import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ToastrService } from 'ngx-toastr';

import { FoodCatalogItem, Meals, UserNutritionPlan, UserNutritionPlanMealItem } from '../../../../core/models/gym.models';
import { AskDialogComponent } from '../../../../shared/ui/ask-dialog.component';
import { FoodsApiService } from '../../../foods/data-access/foods-api.service';
import { UserNutritionPlansApiService } from '../../data-access/user-nutrition-plans-api.service';
import { MealsApiService } from '../../../foods/data-access/meals-api.service';
import { AuthService } from '../../../../core/services/auth.service';

export interface UserNutritionPlanDialogData {
  userId: string;
  userName: string;
}

@Component({
  selector: 'app-user-nutrition-plan-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule
  ],
  templateUrl: './user-nutrition-plan-dialog.component.html',
  styleUrl: './user-nutrition-plan-dialog.component.scss'
})
export class UserNutritionPlanDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly toastr = inject(ToastrService);
  private readonly foodsApiService = inject(FoodsApiService);
  private readonly mealsApiService = inject(MealsApiService);
  private readonly plansApiService = inject(UserNutritionPlansApiService);

  readonly data = inject<UserNutritionPlanDialogData>(MAT_DIALOG_DATA);

  readonly foods = signal<FoodCatalogItem[]>([]);
  readonly userPlans = signal<UserNutritionPlan[]>([]);
  readonly selectedItems = signal<UserNutritionPlanMealItem[]>([]);
  readonly editingPlanId = signal<string | null>(null);
  private readonly authService = inject(AuthService);
  readonly mealTypeOptions: Meals[] = [];

  readonly mealColumns = ['mealType', 'foodName', 'quantity', 'kcal', 'macros', 'actions'];

  readonly totals = computed(() => {
    const items = this.selectedItems();
    return items.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
        carbs: acc.carbs + item.carbs,
        fats: acc.fats + item.fats
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  });

  readonly planForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    objective: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: [''],
    targetCalories: [2200, [Validators.required, Validators.min(1)]],
    notes: ['']
  });

  readonly mealForm = this.fb.nonNullable.group({
    mealType: ['Desayuno' as Meals, Validators.required],
    foodId: [0, Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.1)]],
    notes: ['']
  });

  ngOnInit(): void {
    this.loadFoods();
    this.loadPlans();
    this.loadMeals();
  }

  addMealItem(): void {
    if (this.mealForm.invalid) {
      this.mealForm.markAllAsTouched();
      return;
    }

    const raw = this.mealForm.getRawValue();
    const food = this.foods().find((item) => item.id === Number(raw.foodId));
    if (!food) {
      this.toastr.error('Selecciona un alimento valido.');
      return;
    }

    const qty = Number(raw.quantity) || 1;
    this.selectedItems.update((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        mealType: raw.mealType,
        foodId: food.id,
        foodName: food.name,
        quantity: qty,
        serving: food.serving,
        calories: Number((food.calories * qty).toFixed(1)),
        protein: Number((food.protein * qty).toFixed(1)),
        carbs: Number((food.carbs * qty).toFixed(1)),
        fats: Number((food.fats * qty).toFixed(1)),
        notes: raw.notes
      }
    ]);

    this.mealForm.patchValue({
      mealType: raw.mealType,
      foodId: 0,
      quantity: 1,
      notes: ''
    });

    this.toastr.success('Alimento agregado al plan.');
  }

  removeMealItem(itemId: string): void {
    const item = this.selectedItems().find((entry) => entry.id === itemId);
    const label = item ? item.foodName : 'este alimento';

    this.dialog
      .open(AskDialogComponent, {
        data: {
          title: 'Quitar alimento',
          message: `¿Seguro que quieres quitar ${label} del plan?`
        }
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((confirmed: boolean) => {
        if (!confirmed) {
          return;
        }

        this.selectedItems.update((current) => current.filter((entry) => entry.id !== itemId));
        this.toastr.success('Alimento removido del plan.');
      });
  }

  savePlan(): void {
    if (this.planForm.invalid || this.selectedItems().length === 0) {
      this.planForm.markAllAsTouched();
      if (this.selectedItems().length === 0) {
        this.toastr.info('Agrega al menos un alimento al plan.');
      }
      return;
    }

    const raw = this.planForm.getRawValue();
    const payload: Omit<UserNutritionPlan, 'id'> = {
      userId: this.data.userId,
      name: raw.name,
      objective: raw.objective,
      startDate: raw.startDate,
      endDate: raw.endDate || undefined,
      targetCalories: Number(raw.targetCalories),
      notes: raw.notes,
      items: [...this.selectedItems()]
    };

    const request$ = this.editingPlanId()
      ? this.plansApiService.update({ id: this.editingPlanId() as string, ...payload })
      : this.plansApiService.create(payload);

    request$.pipe(take(1)).subscribe({
      next: () => {
        this.loadPlans();
        this.resetForms();
        this.toastr.success(this.editingPlanId() ? 'Plan actualizado.' : 'Plan guardado.');
      },
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudo guardar el plan de alimentacion.'));
      }
    });
  }

  editPlan(plan: UserNutritionPlan): void {
    this.editingPlanId.set(plan.id);
    this.planForm.patchValue({
      name: plan.name,
      objective: plan.objective,
      startDate: this.toDateInputValue(plan.startDate),
      endDate: this.toDateInputValue(plan.endDate || ''),
      targetCalories: plan.targetCalories,
      notes: plan.notes ?? ''
    });
    this.selectedItems.set([...plan.items]);
  }

  removePlan(plan: UserNutritionPlan): void {
    this.dialog
      .open(AskDialogComponent, {
        data: {
          title: 'Eliminar plan',
          message: `¿Seguro que quieres eliminar el plan ${plan.name}?`
        }
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((confirmed: boolean) => {
        if (!confirmed) {
          return;
        }

        this.plansApiService.remove(plan.id).pipe(take(1)).subscribe({
          next: () => {
            this.loadPlans({ resetIfEmpty: true });
            if (this.editingPlanId() === plan.id) {
              this.resetForms();
            }
            this.toastr.success('Plan eliminado.');
          },
          error: (error: unknown) => {
            this.toastr.error(this.getErrorMessage(error, 'No se pudo eliminar el plan de alimentacion.'));
          }
        });
      });
  }

  resetForms(): void {
    this.editingPlanId.set(null);
    this.selectedItems.set([]);
    this.planForm.reset({
      name: '',
      objective: '',
      startDate: '',
      endDate: '',
      targetCalories: 2200,
      notes: ''
    });
    this.mealForm.reset({
      mealType: { id: 1, nombre: 'Desayuno' },
      foodId: 0,
      quantity: 1,
      notes: ''
    });
  }

  private loadFoods(): void {
    this.foodsApiService.getAll().pipe(take(1)).subscribe({
      next: (foods) => this.foods.set(foods.filter((item) => item.active !== false)),
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudo cargar el catalogo de alimentos.'));
      }
    });
  }

  private loadMeals(): void {
     const companyId = this.authService.snapshot?.user.idEmpresa || 0;
    this.mealsApiService.getByEmpresa(companyId).pipe(take(1)).subscribe({
      next: (meals) => {
        this.mealTypeOptions.push(...meals);
        console.log('Meals loaded:', meals);
      },
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudieron cargar las comidas predefinidas.'));
        }
    });
  }

  private loadPlans(options?: { resetIfEmpty?: boolean }): void {
    this.plansApiService.getByUser(this.data.userId).pipe(take(1)).subscribe({
      next: (plans) => {
        this.userPlans.set(plans);
        if (options?.resetIfEmpty && plans.length === 0) {
          this.resetForms();
        }
      },
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudieron cargar los planes de alimentacion.'));
      }
    });
  }

  private toDateInputValue(value: string): string {
    const raw = (value || '').trim();
    return raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
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
