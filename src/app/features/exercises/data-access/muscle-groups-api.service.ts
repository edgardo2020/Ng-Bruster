import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, MuscleGroupCatalogItem } from '../../../core/models/gym.models';

type ApiMuscleGroup = {
  id?: number;
  description?: string;
  idEmpresa?: number;
};

@Injectable({ providedIn: 'root' })
export class MuscleGroupsApiService {
  private readonly http = inject(HttpClient);
  private readonly mockEnabled = false;
  private mockGroups: MuscleGroupCatalogItem[] = [
    { id: 1, description: 'Pecho' },
    { id: 2, description: 'Espalda' },
    { id: 3, description: 'Hombros' },
    { id: 4, description: 'Brazos' },
    { id: 5, description: 'Piernas' },
    { id: 6, description: 'Core' },
    { id: 7, description: 'Cuerpo completo' },
    { id: 8, description: 'Cardio' }
  ];

  getAll(idEmpresa?: number): Observable<MuscleGroupCatalogItem[]> {
    if (this.mockEnabled) {
      return of([...this.mockGroups]).pipe(delay(220));
    }

    const hasValidCompanyId = Number.isFinite(idEmpresa) && Number(idEmpresa) > 0;
    const endpoint = hasValidCompanyId
      ? `${environment.apiBaseUrl}/MuscleGroupCatalog/ConsultaByIdEmpresa`
      : `${environment.apiBaseUrl}/MuscleGroupCatalog/Consulta`;
    const options = hasValidCompanyId
      ? { params: new HttpParams().set('idEmpresa', String(idEmpresa)) }
      : undefined;

    return this.http.get<ApiResponse<ApiMuscleGroup[]>>(endpoint, options).pipe(
      map((res) => this.getResponseData(res, []).map((item) => this.fromApi(item)))
    );
  }

  create(payload: MuscleGroupCatalogItem, idEmpresa?: number): Observable<MuscleGroupCatalogItem> {
    if (this.mockEnabled) {
      const nextId = Math.max(0, ...this.mockGroups.map((group) => group.id)) + 1;
      const created = { ...payload, id: nextId };
      this.mockGroups = [...this.mockGroups, created];
      return of(created).pipe(delay(180));
    }

    return this.http
      .post<ApiResponse<ApiMuscleGroup>>(
        `${environment.apiBaseUrl}/MuscleGroupCatalog/Agrega`,
        this.toApi(payload, idEmpresa)
      )
      .pipe(
      map((res) => {
        const data = this.getResponseData(res, null);
        return data ? this.fromApi(data) : payload;
      })
    );
  }

  update(payload: MuscleGroupCatalogItem): Observable<MuscleGroupCatalogItem> {
    if (this.mockEnabled) {
      this.mockGroups = this.mockGroups.map((group) => (group.id === payload.id ? payload : group));
      return of(payload).pipe(delay(180));
    }

    return this.http.put<ApiResponse<ApiMuscleGroup>>(`${environment.apiBaseUrl}/MuscleGroupCatalog/Actualiza/`, this.toApi(payload)).pipe(
      map((res) => {
        const data = this.getResponseData(res, null);
        return data ? this.fromApi(data) : payload;
      })
    );
  }

  remove(id: number): Observable<void> {
    if (this.mockEnabled) {
      this.mockGroups = this.mockGroups.filter((group) => group.id !== id);
      return of(void 0).pipe(delay(160));
    }

    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/MuscleGroupCatalog/Elimina?id=${id}`).pipe(
      map((res) => {
        this.ensureSuccess(res, 'No se pudo eliminar el grupo muscular.');
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

  private fromApi(item: ApiMuscleGroup): MuscleGroupCatalogItem {
    return {
      id: Number(item.id ?? 0),
      description: item.description ?? ''
    };
  }

  private toApi(item: MuscleGroupCatalogItem, idEmpresa?: number): ApiMuscleGroup {
    const apiItem: ApiMuscleGroup = {
      id: item.id,
      description: item.description
    };

    if (Number.isFinite(idEmpresa) && Number(idEmpresa) > 0) {
      apiItem.idEmpresa = Number(idEmpresa);
    }

    return apiItem;
  }
}
