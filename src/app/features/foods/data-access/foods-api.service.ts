import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, FoodCatalogItem } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';

type ApiFoodCatalog = {
  id?: string | number;
  idFoodCatalog?: string | number;
  idEmpresa?: number;
  name?: string;
  nombre?: string;
  category?: string;
  categoria?: string;
  serving?: string;
  porcion?: string;
  calories?: string | number;
  calorias?: string | number;
  protein?: string | number;
  proteina?: string | number;
  carbs?: string | number;
  carbohidratos?: string | number;
  fats?: string | number;
  grasas?: string | number;
  active?: boolean | string | number;
  activo?: boolean | string | number;
};

@Injectable({ providedIn: 'root' })
export class FoodsApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  getAll(): Observable<FoodCatalogItem[]> {
    const companyId = this.authService.snapshot?.user.idEmpresa;
    const hasValidCompanyId = Number.isFinite(companyId) && Number(companyId) > 0;
    const endpoint = hasValidCompanyId
      ? `${environment.apiBaseUrl}/FoodCatalog/ConsultaByIdEmpresa`
      : `${environment.apiBaseUrl}/FoodCatalog/Consulta`;
    const options = hasValidCompanyId
      ? { params: new HttpParams().set('idEmpresa', String(companyId)) }
      : undefined;

    return this.http.get<ApiResponse<unknown>>(endpoint, options).pipe(
      map((response) => {
        const payload = this.getResponseData(response, [] as unknown);
        return this.mapCollection(payload);
      })
    );
  }

  getById(id: number): Observable<FoodCatalogItem | null> {
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/FoodCatalog/ConsultaById?id=${id}`).pipe(
      map((response) => {
        const payload = this.getResponseData(response, null as unknown);
        return this.mapSingle(payload);
      })
    );
  }

  getByCategory(category: string): Observable<FoodCatalogItem[]> {
    const params = new HttpParams().set('category', category);
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/FoodCatalog/ConsultaByCategory`, { params }).pipe(
      map((response) => {
        const payload = this.getResponseData(response, [] as unknown);
        return this.mapCollection(payload);
      })
    );
  }

  create(payload: Omit<FoodCatalogItem, 'id'>): Observable<FoodCatalogItem> {
    return this.http.post<ApiResponse<unknown>>(`${environment.apiBaseUrl}/FoodCatalog/Crear`, this.toApi(payload)).pipe(
      map((response) => {
        const data = this.getRequiredResponseData(response);
        const mapped = this.mapSingle(data);
        return mapped ?? { id: 0, ...payload };
      })
    );
  }

  update(payload: FoodCatalogItem): Observable<FoodCatalogItem> {
    return this.http.put<ApiResponse<unknown>>(`${environment.apiBaseUrl}/FoodCatalog/Actualizar?id=${payload.id}`, this.toApi(payload)).pipe(
      map((response) => {
        const data = this.getRequiredResponseData(response);
        const mapped = this.mapSingle(data);
        return mapped ?? payload;
      })
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/FoodCatalog/Eliminar?id=${id}`).pipe(
      map((response) => {
        this.ensureSuccess(response, 'No se pudo eliminar el alimento.');
        return void 0;
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

  private mapCollection(payload: unknown): FoodCatalogItem[] {
    if (!Array.isArray(payload)) {
      const single = this.mapSingle(payload);
      return single ? [single] : [];
    }

    return payload
      .map((item) => this.mapSingle(item))
      .filter((item): item is FoodCatalogItem => item !== null);
  }

  private mapSingle(payload: unknown): FoodCatalogItem | null {
    if (Array.isArray(payload)) {
      return payload.length > 0 ? this.mapSingle(payload[0]) : null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const dto = payload as ApiFoodCatalog;
    return {
      id: this.toNumber(dto.id ?? dto.idFoodCatalog),
      name: dto.name ?? dto.nombre ?? '',
      category: dto.category ?? dto.categoria ?? '',
      serving: dto.serving ?? dto.porcion ?? '',
      calories: this.toNumber(dto.calories ?? dto.calorias),
      protein: this.toNumber(dto.protein ?? dto.proteina),
      carbs: this.toNumber(dto.carbs ?? dto.carbohidratos),
      fats: this.toNumber(dto.fats ?? dto.grasas),
      active: this.toBoolean(dto.active ?? dto.activo, true)
    };
  }

  private toApi(food: Omit<FoodCatalogItem, 'id'> | FoodCatalogItem): ApiFoodCatalog {
    const companyId = this.authService.snapshot?.user.idEmpresa;
    const hasValidCompanyId = Number.isFinite(companyId) && Number(companyId) > 0;

    const apiItem: ApiFoodCatalog = {
      id: 'id' in food ? food.id : undefined,
      name: food.name,
      category: food.category,
      serving: food.serving,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fats: food.fats,
      active: food.active ?? true
    };

    if (hasValidCompanyId) {
      apiItem.idEmpresa = Number(companyId);
    }

    return apiItem;
  }

  private toNumber(value: string | number | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return fallback;
  }
}
