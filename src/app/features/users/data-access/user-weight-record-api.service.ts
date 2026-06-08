import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, UserWeightRecord } from '../../../core/models/gym.models';

type ApiUserWeightRecord = {
  id?: string | number;
  idUserWeightRecord?: string | number;
  userId?: string | number;
  idUser?: string | number;
  usuarioId?: string | number;
  fecha?: string;
  fechaRegistro?: string;
  peso?: string | number;
  comentario?: string;
};

@Injectable({ providedIn: 'root' })
export class UserWeightRecordApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<UserWeightRecord[]> {
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/UserWeightRecord/Consulta`).pipe(
      map((response) => {
        const payload = this.getResponseData(response, [] as unknown);
        return this.mapCollection(payload);
      })
    );
  }

  getById(id: string): Observable<UserWeightRecord | null> {
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/UserWeightRecord/ConsultaById?id=${id}`).pipe(
      map((response) => {
        const payload = this.getResponseData(response, null as unknown);
        return this.mapSingle(payload);
      })
    );
  }

  getByUserId(userId: string): Observable<UserWeightRecord[]> {
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/UserWeightRecord/ConsultaByUserId?userId=${userId}`).pipe(
      map((response) => {
        const payload = this.getResponseData(response, [] as unknown);
        return this.mapCollection(payload);
      })
    );
  }

  create(payload: Omit<UserWeightRecord, 'id'>): Observable<UserWeightRecord> {
    return this.http.post<ApiResponse<unknown>>(`${environment.apiBaseUrl}/UserWeightRecord/Crear`, this.toApi(payload)).pipe(
      map((response) => {
        const data = this.getRequiredResponseData(response);
        const mapped = this.mapSingle(data);
        return mapped ?? { ...payload };
      })
    );
  }

  update(payload: UserWeightRecord): Observable<UserWeightRecord> {
    return this.http.put<ApiResponse<unknown>>(`${environment.apiBaseUrl}/UserWeightRecord/Actualizar`, this.toApi(payload)).pipe(
      map((response) => {
        const data = this.getRequiredResponseData(response);
        const mapped = this.mapSingle(data);
        return mapped ?? payload;
      })
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/UserWeightRecord/Eliminar?id=${id}`).pipe(
      map((response) => {
        this.ensureSuccess(response, 'No se pudo eliminar el registro de peso.');
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

  private mapCollection(payload: unknown): UserWeightRecord[] {
    if (!Array.isArray(payload)) {
      const single = this.mapSingle(payload);
      return single ? [single] : [];
    }

    return payload
      .map((item) => this.mapSingle(item))
      .filter((item): item is UserWeightRecord => item !== null);
  }

  private mapSingle(payload: unknown): UserWeightRecord | null {
    if (Array.isArray(payload)) {
      return payload.length > 0 ? this.mapSingle(payload[0]) : null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const dto = payload as ApiUserWeightRecord;
    const userId = dto.userId ?? dto.idUser ?? dto.usuarioId;

    return {
      id: dto.id != null ? String(dto.id) : dto.idUserWeightRecord != null ? String(dto.idUserWeightRecord) : undefined,
      userId: userId != null ? String(userId) : '',
      fecha: dto.fecha ?? dto.fechaRegistro ?? new Date().toISOString(),
      peso: this.toNumber(dto.peso),
      comentario: dto.comentario ?? ''
    };
  }

  private toApi(record: Omit<UserWeightRecord, 'id'> | UserWeightRecord): ApiUserWeightRecord {
    return {
      id: 'id' in record ? record.id : undefined,
      userId: record.userId,
      fecha: this.toApiDate(record.fecha),
      peso: record.peso,
      comentario: record.comentario ?? ''
    };
  }

  private toApiDate(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    const raw = String(value ?? '').trim();
    if (!raw) {
      return new Date().toISOString();
    }

    return raw;
  }

  private toNumber(value: string | number | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
