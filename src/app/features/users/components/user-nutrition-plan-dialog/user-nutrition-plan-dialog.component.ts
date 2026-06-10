import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
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
    MatDatepickerModule,
    MatNativeDateModule,
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
  private readonly authService = inject(AuthService);

  @Input() userId = '';
  @Input() userName = '';
  @Output() back = new EventEmitter<void>();

  private readonly dialogData = inject<UserNutritionPlanDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  readonly isDialog = computed(() => this.dialogData != null);
  readonly effectiveUserId = computed(() => this.userId || this.dialogData?.userId || '');
  readonly effectiveUserName = computed(() => this.userName || this.dialogData?.userName || '');

  readonly foods = signal<FoodCatalogItem[]>([]);
  readonly userPlans = signal<UserNutritionPlan[]>([]);
  readonly selectedItems = signal<UserNutritionPlanMealItem[]>([]);
  readonly editingPlanId = signal<string | null>(null);
  readonly mobileViewPlansOnly = signal(true);
  readonly isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  readonly plansCarouselIndex = signal(0);
  private readonly plansCarouselRef = viewChild<ElementRef<HTMLElement>>('plansCarousel');
  readonly mealTypeOptions: Meals[] = [];

  readonly mealColumns = ['mealType', 'foodName', 'quantity', 'kcal', 'macros', 'actions'];
  readonly pageSize = 4;
  readonly currentPage = signal(1);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.selectedItems().length / this.pageSize)));
  readonly paginatedItems = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.selectedItems().slice(start, start + this.pageSize);
  });

  changePage(delta: 1 | -1): void {
    const next = this.currentPage() + delta;
    if (next >= 1 && next <= this.totalPages()) {
      this.currentPage.set(next);
    }
  }

  onPlansScroll(): void {
    const el = this.plansCarouselRef()?.nativeElement;
    if (!el) return;
    const cardWidth = el.querySelector('.plan-item')?.clientWidth ?? 1;
    if (!cardWidth) return;
    const idx = Math.round(el.scrollLeft / cardWidth);
    this.plansCarouselIndex.set(idx);
  }

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
    startDate: [null as Date | null, Validators.required],
    endDate: [null as Date | null],
    targetCalories: [2200, [Validators.required, Validators.min(1)]],
    notes: ['']
  });

  readonly mealForm = this.fb.nonNullable.group({
    mealType: [{ id: 0, nombre: ''} , Validators.required],
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
        id: "",
        mealType: raw.mealType.nombre,
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

    this.currentPage.set(1);

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
        this.currentPage.set(1);
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
    const toDateStr = (d: Date | null | string): string | undefined =>
      d ? (typeof d === 'string' ? d : d.toISOString().split('T')[0]) : undefined;
    const payload: Omit<UserNutritionPlan, 'id'> = {
      userId: this.effectiveUserId(),
      name: raw.name,
      objective: raw.objective,
      startDate: toDateStr(raw.startDate) ?? '',
      endDate: toDateStr(raw.endDate),
      targetCalories: Number(raw.targetCalories),
      notes: raw.notes,
      items: [...this.selectedItems()]
    };
    //return

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
      startDate: plan.startDate ? new Date(plan.startDate) : null,
      endDate: plan.endDate ? new Date(plan.endDate) : null,
      targetCalories: plan.targetCalories,
      notes: plan.notes ?? ''
    });
    this.selectedItems.set([...plan.items]);
    if (this.isMobile) {
      this.mobileViewPlansOnly.set(false);
    }
  }

  handleBack(): void {
    if (this.mobileViewPlansOnly()) {
      this.back.emit();
    } else {
      this.mobileViewPlansOnly.set(true);
      this.resetForms();
    }
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

  resetCompleted(): void {
    this.dialog
      .open(AskDialogComponent, {
        data: {
          title: 'Reiniciar estado',
          message: '¿Seguro que quieres reiniciar todos los alimentos completados?'
        }
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;

        const planId = this.editingPlanId();
        if (!planId) return;

        const plan = this.userPlans().find((p) => p.id === planId);
        if (!plan) return;

        const updatedItems = plan.items.map((item) => ({ ...item, completed: false }));
        this.selectedItems.set(updatedItems);

        this.plansApiService
          .update({ ...plan, items: updatedItems })
          .pipe(take(1))
          .subscribe({
            next: () => {
              this.loadPlans();
              setTimeout(() => this.toastr.success('Estado de alimentos reiniciado.', '', { timeOut: 5000 }), 300);
            },
            error: (error: unknown) => {
              this.toastr.error(this.getErrorMessage(error, 'No se pudo reiniciar el estado.'));
            }
          });
      });
  }

  resetForms(): void {
    this.editingPlanId.set(null);
    this.selectedItems.set([]);
    this.currentPage.set(1);
    if (this.isMobile) {
      this.mobileViewPlansOnly.set(true);
    }
    this.planForm.reset({
      name: '',
      objective: '',
      startDate: null,
      endDate: null,
      targetCalories: 2200,
      notes: ''
    });
    this.mealForm.reset({
      mealType: { id: 0, nombre: ''},
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
      },
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudieron cargar las comidas predefinidas.'));
        }
    });
  }

  private loadPlans(options?: { resetIfEmpty?: boolean }): void {
    this.plansApiService.getByUser(this.effectiveUserId()).pipe(take(1)).subscribe({
      next: (plans) => {
        this.userPlans.set(plans);
        console.log('Loaded user plans:', plans);
        if (options?.resetIfEmpty && plans.length === 0) {
          this.resetForms();
        }
      },
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudieron cargar los planes de alimentacion.'));
      }
    });
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
