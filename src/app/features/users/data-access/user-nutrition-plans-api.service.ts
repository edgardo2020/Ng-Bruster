import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, UserNutritionPlan, UserNutritionPlanMealItem } from '../../../core/models/gym.models';

type ApiUserNutritionPlanItem = {
  id?: string | number;
  mealType?: string;
  foodId?: string | number;
  foodName?: string;
  quantity?: string | number;
  serving?: string;
  calories?: string | number;
  protein?: string | number;
  carbs?: string | number;
  fats?: string | number;
  notes?: string;
};

type ApiUserNutritionPlan = {
  id?: string | number;
  userId?: string | number;
  name?: string;
  objective?: string;
  startDate?: string;
  endDate?: string;
  targetCalories?: string | number;
  notes?: string;
  items?: unknown;
};

@Injectable({ providedIn: 'root' })
export class UserNutritionPlansApiService {
  private readonly http = inject(HttpClient);

  getByUser(userId: string): Observable<UserNutritionPlan[]> {
    return this.http
      .get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/UserNutritionPlan/ConsultaByUser?userId=${encodeURIComponent(userId)}`)
      .pipe(
      map((response) => {
        const payload = this.getResponseData(response, [] as unknown);
        return this.mapCollection(payload);
      })
    );
  }

  create(payload: Omit<UserNutritionPlan, 'id'>): Observable<UserNutritionPlan> {
    return this.http.post<ApiResponse<unknown>>(`${environment.apiBaseUrl}/UserNutritionPlan/Crear`, this.toApi(payload)).pipe(
      map((response) => {
        const data = this.getRequiredResponseData(response);
        const mapped = this.mapSingle(data);
        return mapped ?? { id: crypto.randomUUID(), ...payload };
      })
    );
  }

  update(payload: UserNutritionPlan): Observable<UserNutritionPlan> {
    return this.http.put<ApiResponse<unknown>>(`${environment.apiBaseUrl}/UserNutritionPlan/Actualizar?id=${encodeURIComponent(payload.id)}`, this.toApi(payload)).pipe(
      map((response) => {
        const data = this.getRequiredResponseData(response);
        const mapped = this.mapSingle(data);
        return mapped ?? payload;
      })
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/UserNutritionPlan/Eliminar?id=${encodeURIComponent(id)}`).pipe(
      map((response) => {
        this.ensureSuccess(response, 'No se pudo eliminar el plan de alimentacion.');
        return void 0;
      })
    );
  }

  getById(id: string): Observable<UserNutritionPlan | null> {
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/UserNutritionPlan/ConsultaById?id=${encodeURIComponent(id)}`).pipe(
      map((response) => {
        const payload = this.getResponseData(response, null as unknown);
        return this.mapSingle(payload);
      })
    );
  }

  private ensureSuccess<T>(response: ApiResponse<T>, fallbackMessage: string): void {
    if (!response.exito) {
      throw new Error(response.mensaje || fallbackMessage);
    }
  }

  private getResponseData<T>(response: ApiResponse<T>, fallback: T): T {
    this.ensureSuccess(response, 'No se pudo procesar la respuesta del servidor.');
    return response.respuesta ?? fallback;
  }

  private getRequiredResponseData<T>(response: ApiResponse<T>): T {
    this.ensureSuccess(response, 'No se pudo procesar la respuesta del servidor.');
    if (response.respuesta == null) {
      throw new Error(response.mensaje || 'La API no devolvio datos.');
    }
    return response.respuesta;
  }

  private mapCollection(payload: unknown): UserNutritionPlan[] {
    if (!Array.isArray(payload)) {
      const single = this.mapSingle(payload);
      return single ? [single] : [];
    }

    return payload
      .map((item) => this.mapSingle(item))
      .filter((item): item is UserNutritionPlan => item !== null);
  }

  private mapSingle(payload: unknown): UserNutritionPlan | null {
    if (Array.isArray(payload)) {
      return payload.length > 0 ? this.mapSingle(payload[0]) : null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const dto = payload as ApiUserNutritionPlan;
    const itemsPayload = dto.items;

    if (dto.id == null || dto.userId == null) {
      throw new Error('UserNutritionPlan DTO invalido: id o userId faltante.');
    }

    return {
      id: String(dto.id),
      userId: String(dto.userId),
      name: dto.name ?? '',
      objective: dto.objective ?? '',
      startDate: dto.startDate ?? '',
      endDate: dto.endDate ?? undefined,
      targetCalories: this.toNumber(dto.targetCalories),
      notes: dto.notes ?? '',
      items: this.mapItems(itemsPayload)
    };
  }

  private mapItems(payload: unknown): UserNutritionPlanMealItem[] {
    if (!Array.isArray(payload)) {
      const single = this.mapItem(payload);
      return single ? [single] : [];
    }

    return payload
      .map((item) => this.mapItem(item))
      .filter((item): item is UserNutritionPlanMealItem => item !== null);
  }

  private mapItem(payload: unknown): UserNutritionPlanMealItem | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const dto = payload as ApiUserNutritionPlanItem;

    if (dto.foodId == null) {
      throw new Error('UserNutritionPlanItem DTO invalido: foodId faltante.');
    }

    return {
      id: dto.id != null ? String(dto.id) : crypto.randomUUID(),
    //  mealType: this.toMealType(dto.mealType),
      foodId: this.toNumber(dto.foodId),
      foodName: dto.foodName ?? '',
      quantity: this.toNumber(dto.quantity, 1),
      serving: dto.serving ?? '',
      calories: this.toNumber(dto.calories),
      protein: this.toNumber(dto.protein),
      carbs: this.toNumber(dto.carbs),
      fats: this.toNumber(dto.fats),
      notes: dto.notes ?? ''
    };
  }

  private toApi(plan: Omit<UserNutritionPlan, 'id'> | UserNutritionPlan): ApiUserNutritionPlan {
    return {
      id: 'id' in plan ? plan.id : undefined,
      userId: plan.userId,
      name: plan.name,
      objective: plan.objective,
      startDate: plan.startDate,
      endDate: plan.endDate,
      targetCalories: plan.targetCalories,
      notes: plan.notes ?? '',
      items: plan.items.map((item) => this.toApiItem(item))
    };
  }

  private toApiItem(item: UserNutritionPlanMealItem): ApiUserNutritionPlanItem {
    return {
      id: item.id,
      //mealType: item.mealType,
      foodId: item.foodId,
      foodName: item.foodName,
      quantity: item.quantity,
      serving: item.serving,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      notes: item.notes ?? ''
    };
  }

  private toNumber(value: string | number | undefined, fallback = 0): number {
    const parsed = Number(value ?? fallback);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /*private toMealType(value: string | undefined): Meals {
    const normalized = String(value ?? '').trim();
    const allowed: Meals[] = ['Desayuno', 'Media manana', 'Almuerzo', 'Merienda', 'Cena', 'Snack'];
    return allowed.includes(normalized as Meals) ? (normalized as Meals) : 'Desayuno';
  }*/
}
