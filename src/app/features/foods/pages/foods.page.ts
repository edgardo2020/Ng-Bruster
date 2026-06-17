import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, TemplateRef, ViewChild, inject, signal, viewChild } from '@angular/core';
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

import { FoodCatalogItem, UserNutritionPlan, UserNutritionPlanMealItem } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { AskDialogComponent } from '../../../shared/ui/ask-dialog.component';
import { FoodsApiService } from '../data-access/foods-api.service';
import { UserNutritionPlansApiService } from '../../users/data-access/user-nutrition-plans-api.service';

@Component({
  selector: 'app-foods-page',
  standalone: true,
  imports: [
    CommonModule,
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

  private readonly dayIndexMap: Record<string, number> = {
    Lunes: 0, Martes: 1, Miércoles: 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6
  };
  readonly weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  readonly detailDialog = signal<{ plan: UserNutritionPlan; field: 'objective' | 'notes'; label: string } | null>(null);
  readonly plansCarouselIndex = signal(0);

  onPlansScroll(): void {
    const el = this.plansCarouselRef()?.nativeElement;
    if (!el) return;
    const cardWidth = el.querySelector('.plan-item')?.clientWidth ?? 1;
    if (!cardWidth) return;
    const idx = Math.round(el.scrollLeft / cardWidth);
    const prev = this.plansCarouselIndex();
    this.plansCarouselIndex.set(idx);
    if (idx !== prev) {
      const plan = this.userPlans()[idx];
      if (plan) {
        this.collapsedPlans.update(s => {
          const next = new Set(s);
          next.delete(plan.id);
          return next;
        });
      }
    }
    setTimeout(() => this.adjustContainerHeight(), 0);
  }

  private adjustContainerHeight(): void {
    if (typeof window === 'undefined' || window.innerWidth > 760) return;
    const container = this.plansCarouselRef()?.nativeElement;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>('.plan-item');
    const item = items[this.plansCarouselIndex()];
    if (item) {
      container.style.height = `${item.scrollHeight}px`;
    }
  }

  private readonly plansCarouselRef = viewChild<ElementRef<HTMLElement>>('plansCarousel');

  openDetailDialog(plan: UserNutritionPlan, field: 'objective' | 'notes'): void {
    const label = field === 'objective' ? 'Objetivo' : 'Notas';
    this.detailDialog.set({ plan, field, label });
  }

  closeDetailDialog(): void {
    this.detailDialog.set(null);
  }

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
  readonly collapsedPlans = signal<Set<string>>(new Set());
  readonly collapsedDays = signal<Set<string>>(new Set());

  isCollapsed(planId: string): boolean {
    return this.collapsedPlans().has(planId);
  }

  toggleCollapse(planId: string): void {
    this.collapsedPlans.update((set) => {
      const next = new Set(set);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
    setTimeout(() => this.adjustContainerHeight(), 0);
  }

  isDayCollapsed(planId: string, day: string): boolean {
    return this.collapsedDays().has(`${planId}-${day}`);
  }

  toggleDayCollapse(planId: string, day: string): void {
    this.collapsedDays.update((set) => {
      const next = new Set(set);
      const key = `${planId}-${day}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setTimeout(() => this.adjustContainerHeight(), 0);
  }
  readonly displayedColumns = ['name', 'category', 'serving', 'calories', 'macros', 'active', 'actions'];
  readonly planColumns = ['order', 'mealType', 'foodName', 'quantity', 'kcal', 'macros', 'notes', 'done'];

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

  toggleItemStatus(plan: UserNutritionPlan, item: UserNutritionPlanMealItem): void {
    item.completed = !item.completed;
    this.userNutritionPlansApiService.update(plan).pipe(take(1)).subscribe({
      error: () => {
        item.completed = !item.completed;
        this.toastr.error('No se pudo actualizar el estado del alimento.');
      }
    });
  }

  private scrollToFirstIncomplete(): void {
    const items = Array.from(document.querySelectorAll('[data-completed="false"]'));
    for (const el of items) {
      if (el instanceof HTMLElement && el.offsetParent !== null) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  }

  getPlanTotals(plan: UserNutritionPlan): { protein: number; carbs: number; fats: number } {
    return plan.items.reduce(
      (acc, item) => ({
        protein: acc.protein + (item.protein ?? 0),
        carbs: acc.carbs + (item.carbs ?? 0),
        fats: acc.fats + (item.fats ?? 0),
      }),
      { protein: 0, carbs: 0, fats: 0 }
    );
  }

  getCompletedTotals(plan: UserNutritionPlan): { protein: number; carbs: number; fats: number; pct: number } {
    const total = this.getPlanTotals(plan);
    const completed = plan.items
      .filter((item) => item.completed)
      .reduce(
        (acc, item) => ({
          protein: acc.protein + (item.protein ?? 0),
          carbs: acc.carbs + (item.carbs ?? 0),
          fats: acc.fats + (item.fats ?? 0),
        }),
        { protein: 0, carbs: 0, fats: 0 }
      );
    const totalKcal = total.protein * 4 + total.carbs * 4 + total.fats * 9;
    const completedKcal = completed.protein * 4 + completed.carbs * 4 + completed.fats * 9;
    const pct = totalKcal > 0 ? Math.round((completedKcal / totalKcal) * 100) : 0;
    return { ...completed, pct };
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

  getSortedItems(items: UserNutritionPlanMealItem[]): UserNutritionPlanMealItem[] {
    return [...items].sort((a, b) => {
      const da = this.dayIndexMap[a.day || ''] ?? 99;
      const db = this.dayIndexMap[b.day || ''] ?? 99;
      if (da !== db) return da - db;
      return (a.order ?? 99) - (b.order ?? 99);
    });
  }

  itemsByDay(items: UserNutritionPlanMealItem[]): { day: string; items: UserNutritionPlanMealItem[] }[] {
    const map = new Map<string, UserNutritionPlanMealItem[]>();
    for (const item of this.getSortedItems(items)) {
      const day = item.day || 'Sin día';
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(item);
    }
    return this.weekDays
      .filter((d) => map.has(d))
      .map((d) => ({ day: d, items: map.get(d)! }));
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
      next: (plans) => {
        this.userPlans.set(plans);
        const collapsed = new Set<string>();
        for (const plan of plans) {
          if (this.getCompletedTotals(plan).pct === 100) {
            collapsed.add(plan.id);
          }
        }
        this.collapsedPlans.set(collapsed);
        setTimeout(() => this.scrollToFirstIncomplete(), 100);
        setTimeout(() => this.adjustContainerHeight(), 200);
      },
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
