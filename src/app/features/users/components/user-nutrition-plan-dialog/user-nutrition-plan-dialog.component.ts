import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { ToastrService } from 'ngx-toastr';

import { FoodCatalogItem, Meals, UserNutritionPlan, UserNutritionPlanMealItem } from '../../../../core/models/gym.models';
import { AskDialogComponent } from '../../../../shared/ui/ask-dialog.component';
import { FoodsApiService } from '../../../foods/data-access/foods-api.service';
import { UserNutritionPlansApiService } from '../../data-access/user-nutrition-plans-api.service';
import { MealsApiService } from '../../../foods/data-access/meals-api.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-user-nutrition-plan-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatTabsModule,
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

  readonly foods = signal<FoodCatalogItem[]>([]);
  readonly foodSearchText = signal('');
  readonly filteredFoods = computed(() => {
    const search = this.foodSearchText().toLowerCase().trim();
    if (!search) return this.foods();
    return this.foods().filter((f) => f.name.toLowerCase().includes(search));
  });
  readonly userPlans = signal<UserNutritionPlan[]>([]);
  readonly selectedItems = signal<UserNutritionPlanMealItem[]>([]);
  readonly editingPlanId = signal<string | null>(null);
  readonly mobileViewPlansOnly = signal(true);
  readonly showFullForm = signal(false);
  readonly isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  readonly plansCarouselIndex = signal(0);
  private readonly plansCarouselRef = viewChild<ElementRef<HTMLElement>>('plansCarousel');
  readonly mealTypeOptions: Meals[] = [];

  readonly mealColumns = ['mealType', 'foodName', 'quantity', 'kcal', 'macros', 'actions'];
  readonly dayLabels = ['Todos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  readonly selectedDayFilter = signal('');

  readonly filteredByDay = computed(() => {
    const day = this.selectedDayFilter();
    if (!day) return this.selectedItems();
    return this.selectedItems().filter((item) => item.day === day);
  });

  readonly availableDays = computed(() => {
    const days = new Set(this.selectedItems().map((item) => item.day || ''));
    return ['', ...this.dayLabels.slice(1)].filter((d) => days.has(d));
  });

  readonly dayItemsMap = computed(() => {
    const map = new Map<string, UserNutritionPlanMealItem[]>();
    const days = this.availableDays();
    for (const day of days) {
      map.set(day, this.selectedItems().filter((item) => (item.day || '') === day));
    }
    return map;
  });

  readonly dayCarouselIndex = signal(0);
  private readonly dayCarouselRef = viewChild<ElementRef<HTMLElement>>('dayCarousel');

  onDayCarouselScroll(): void {
    const el = this.dayCarouselRef()?.nativeElement;
    if (!el) return;
    const cardWidth = el.querySelector('.day-slide')?.clientWidth ?? 1;
    if (!cardWidth) return;
    const idx = Math.round(el.scrollLeft / cardWidth);
    this.dayCarouselIndex.set(idx);
  }

  selectDayTab(day: string): void {
    this.selectedDayFilter.set(day);
  }

  readonly pageSize = 4;
  readonly currentPage = signal(1);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredByDay().length / this.pageSize)));
  readonly paginatedItems = computed(() => {
    const items = this.filteredByDay();
    const start = (this.currentPage() - 1) * this.pageSize;
    return items.slice(start, start + this.pageSize);
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

  readonly daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  readonly mealForm = this.fb.nonNullable.group({
    mealType: [{ id: 0, nombre: ''} , Validators.required],
    foodId: [0, Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.1)]],
    day: [''],
    notes: ['']
  });

  ngOnInit(): void {
    this.loadFoods();
    this.loadPlans();
    this.loadMeals();
  }

  onFoodSelected(event: { option: { value: number } }): void {
    this.mealForm.controls.foodId.setValue(event.option.value);
    this.foodSearchText.set('');
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
    const newItem: UserNutritionPlanMealItem = {
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
      day: raw.day || '',
      notes: raw.notes
    };
    this.selectedItems.update((current) => [...current, newItem]);

    this.currentPage.set(1);

    this.mealForm.patchValue({
      mealType: raw.mealType,
      foodId: 0,
      quantity: 1,
      notes: ''
    });
    this.foodSearchText.set('');

    const toDateStr = (d: Date | null | string): string | undefined =>
      d ? (typeof d === 'string' ? d : d.toISOString().split('T')[0]) : undefined;
    const planRaw = this.planForm.getRawValue();
    const payload: Omit<UserNutritionPlan, 'id'> = {
      userId: this.userId,
      name: planRaw.name || 'Plan de alimentacion',
      objective: planRaw.objective || '',
      startDate: toDateStr(planRaw.startDate) ?? new Date().toISOString().split('T')[0],
      endDate: toDateStr(planRaw.endDate),
      targetCalories: Number(planRaw.targetCalories) || 2200,
      notes: planRaw.notes || '',
      items: [...this.selectedItems()]
    };

    const request$ = this.editingPlanId()
      ? this.plansApiService.update({ id: this.editingPlanId() as string, ...payload })
      : this.plansApiService.create(payload);

    request$.pipe(take(1)).subscribe({
      next: (saved) => {
        if (!this.editingPlanId()) {
          this.editingPlanId.set(saved.id);
        }
        this.loadPlans();
        this.toastr.success('Alimento agregado al plan.');
      },
      error: (error: unknown) => {
        this.toastr.error(this.getErrorMessage(error, 'No se pudo guardar el alimento.'));
      }
    });
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
      userId: this.userId,
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
        this.plansApiService.getByUser(this.userId).pipe(take(1)).subscribe((plans) => {
          this.userPlans.set(plans);
          const saved = this.editingPlanId()
            ? plans.find((p) => p.id === this.editingPlanId())
            : plans.at(-1);
          if (saved) {
            this.editingPlanId.set(saved.id);
            this.planForm.patchValue({
              name: saved.name,
              objective: saved.objective,
              startDate: saved.startDate ? new Date(saved.startDate) : null,
              endDate: saved.endDate ? new Date(saved.endDate) : null,
              targetCalories: saved.targetCalories,
              notes: saved.notes ?? ''
            });
            this.selectedItems.set([...saved.items]);
          }
          this.mobileViewPlansOnly.set(false);
          this.showFullForm.set(false);
        });
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
    this.mobileViewPlansOnly.set(false);
    this.showFullForm.set(false);
  }

  handleBack(): void {
    if (this.isMobile && !this.mobileViewPlansOnly()) {
      this.mobileViewPlansOnly.set(true);
      this.resetForms();
    } else {
      this.back.emit();
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
    this.mobileViewPlansOnly.set(true);
    this.showFullForm.set(false);
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
      day: '',
      notes: ''
    });
    this.foodSearchText.set('');
  }

  newPlan(): void {
    this.mobileViewPlansOnly.set(false);
    this.showFullForm.set(true);
  }

  expandForm(): void {
    this.showFullForm.set(true);
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
    this.plansApiService.getByUser(this.userId).pipe(take(1)).subscribe({
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
