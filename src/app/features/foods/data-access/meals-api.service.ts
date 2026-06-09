import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';

 type Meals = {
  id?:  number;
  nombre?: string ;
  idEmpresa?: number;
};


@Injectable({ providedIn: 'root' })
export class MealsApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  getAll(): Observable<Meals[]> {
    const companyId = this.authService.snapshot?.user.idEmpresa;
    const hasValidCompanyId = Number.isFinite(companyId) && Number(companyId) > 0;
    const endpoint = hasValidCompanyId
      ? `${environment.apiBaseUrl}/Meals/ConsultaByIdEmpresa`
      : `${environment.apiBaseUrl}/Meals/Consulta`;
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

  getById(id: number): Observable<Meals | null> {
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/Meals/ConsultaById?id=${id}`).pipe(
      map((response) => {
        const payload = this.getResponseData(response, null as unknown);
        return this.mapSingle(payload);
      })
    );
  }

  getByCategory(category: string): Observable<Meals[]> {
    const params = new HttpParams().set('category', category);
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/Meals/ConsultaByCategory`, { params }).pipe(
      map((response) => {
        const payload = this.getResponseData(response, [] as unknown);
        return this.mapCollection(payload);
      })
    );
  }

  create(payload: Omit<Meals, 'id'>): Observable<Meals> {
    return this.http.post<ApiResponse<unknown>>(`${environment.apiBaseUrl}/Meals/Crear`, this.toApi(payload)).pipe(
      map((response) => {
        const data = this.getRequiredResponseData(response);
        const mapped = this.mapSingle(data);
        return mapped ?? { id: 0, ...payload };
      })
    );
  }

  update(payload: Meals): Observable<Meals> {
    return this.http.put<ApiResponse<unknown>>(`${environment.apiBaseUrl}/Meals/Actualizar?id=${payload.id}`, this.toApi(payload)).pipe(
      map((response) => {
        const data = this.getRequiredResponseData(response);
        const mapped = this.mapSingle(data);
        return mapped ?? payload;
      })
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/Meals/Eliminar?id=${id}`).pipe(
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

  private mapCollection(payload: unknown): Meals[] {
    if (!Array.isArray(payload)) {
      const single = this.mapSingle(payload);
      return single ? [single] : [];
    }

    return payload
      .map((item) => this.mapSingle(item))
      .filter((item): item is Meals => item !== null);
  }

  private mapSingle(payload: unknown): Meals | null {
    if (Array.isArray(payload)) {
      return payload.length > 0 ? this.mapSingle(payload[0]) : null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const dto = payload as Meals;
    return {
      id: this.toNumber(dto.id ?? dto.id),
      nombre: dto.nombre ?? dto.nombre,
      idEmpresa: dto.idEmpresa,
    };
  }

  private toApi(food: Omit<Meals, 'id'> | Meals): Meals {
    const apiItem: Meals = {
      id: 'id' in food ? food.id : undefined,
      nombre: food.nombre,
      idEmpresa: food.idEmpresa,
    };
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

  getByEmpresa(idEmpresa: number): Observable<Meals[]> {
      const params = new HttpParams().set('idEmpresa', String(idEmpresa));
      return this.http.get<ApiResponse<Meals[]>>(`${environment.apiBaseUrl}/Meals/ConsultaByIdEmpresa`, { params }).pipe(
        map((res) => this.getResponseData(res, []).map((item) => this.toApi(item)))
      );
    }
}
