import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';

import { FoodCatalogItem } from '../../../../core/models/gym.models';
import { FoodsApiService } from '../../../foods/data-access/foods-api.service';

@Component({
  selector: 'app-foods-catalog-dialog',
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
    MatTableModule
  ],
  templateUrl: './foods-catalog-dialog.component.html',
  styleUrl: './foods-catalog-dialog.component.scss'
})
export class FoodsCatalogDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly foodsApiService = inject(FoodsApiService);

  readonly foods = signal<FoodCatalogItem[]>([]);
  readonly editingId = signal<number | null>(null);
  readonly displayedColumns = ['name', 'category', 'serving', 'kcal', 'macros', 'active', 'actions'];

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
    this.loadFoods();
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
      this.resetForm();
    });
  }

  remove(food: FoodCatalogItem): void {
    this.foodsApiService.remove(food.id).pipe(take(1)).subscribe(() => {
      this.loadFoods();
      if (this.editingId() === food.id) {
        this.resetForm();
      }
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
    this.foodsApiService.getAll().pipe(take(1)).subscribe((foods) => this.foods.set(foods));
  }
}
