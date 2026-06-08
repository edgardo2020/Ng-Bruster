import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

import { FoodCatalogItem } from '../../../core/models/gym.models';

@Injectable({ providedIn: 'root' })
export class FoodsApiService {
  private readonly mockDelayMs = 180;
  private mockFoods: FoodCatalogItem[] = [
    {
      id: 1,
      name: 'Pechuga de pollo',
      category: 'Proteina',
      serving: '100 g',
      calories: 165,
      protein: 31,
      carbs: 0,
      fats: 3.6,
      active: true
    },
    {
      id: 2,
      name: 'Arroz integral',
      category: 'Carbohidrato',
      serving: '100 g',
      calories: 111,
      protein: 2.6,
      carbs: 23,
      fats: 0.9,
      active: true
    },
    {
      id: 3,
      name: 'Aguacate',
      category: 'Grasa saludable',
      serving: '50 g',
      calories: 80,
      protein: 1,
      carbs: 4,
      fats: 7.5,
      active: true
    }
  ];

  getAll(): Observable<FoodCatalogItem[]> {
    return of([...this.mockFoods]).pipe(delay(this.mockDelayMs));
  }

  create(payload: Omit<FoodCatalogItem, 'id'>): Observable<FoodCatalogItem> {
    const created: FoodCatalogItem = {
      id: Math.max(0, ...this.mockFoods.map((item) => item.id)) + 1,
      ...payload
    };
    this.mockFoods = [created, ...this.mockFoods];
    return of(created).pipe(delay(this.mockDelayMs));
  }

  update(payload: FoodCatalogItem): Observable<FoodCatalogItem> {
    this.mockFoods = this.mockFoods.map((item) => (item.id === payload.id ? payload : item));
    return of(payload).pipe(delay(this.mockDelayMs));
  }

  remove(id: number): Observable<void> {
    this.mockFoods = this.mockFoods.filter((item) => item.id !== id);
    return of(void 0).pipe(delay(this.mockDelayMs));
  }
}
