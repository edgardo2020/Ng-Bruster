import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, UserPhysicalProfile } from '../../../core/models/gym.models';

type ApiUserPhysicalProfile = {
  id?: string | number;
  idObjetivoUsuario?: string | number;
  userId?: string | number;
  idUser?: string | number;
  usuarioId?: string | number;
  pesoInicio?: string | number;
  pesoInicial?: string | number;
  pesoObjetivo?: string | number;
  fechaInicio?: string;
  altura?: string | number;
  pesoIdeal?: string | number;
  imc?: string | number;
  comentario?: string;
};

@Injectable({ providedIn: 'root' })
export class UserPhysicalProfileApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<UserPhysicalProfile[]> {
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/ObjetivoUsuario/Consulta`).pipe(
      map((response) => {
        const payload = this.getResponseData(response, [] as unknown);
        return this.mapCollection(payload);
      })
    );
  }

  getById(id: string): Observable<UserPhysicalProfile | null> {
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/ObjetivoUsuario/ConsultaById?id=${id}`).pipe(
      map((response) => {
        const payload = this.getResponseData(response, null as unknown);
        return this.mapSingle(payload);
      })
    );
  }

  getByUserId(userId: string): Observable<UserPhysicalProfile | null> {
    return this.http.get<ApiResponse<unknown>>(`${environment.apiBaseUrl}/ObjetivoUsuario/ConsultaByUserId?userId=${userId}`).pipe(
      map((response) => {
        const payload = this.getResponseData(response, null as unknown);
        return this.mapSingle(payload);
      })
    );
  }

  create(payload: Omit<UserPhysicalProfile, 'id'>): Observable<UserPhysicalProfile> {
    return this.http.post<ApiResponse<unknown>>(`${environment.apiBaseUrl}/ObjetivoUsuario/Crear`, this.toApi(payload)).pipe(
      map((response) => {
        const data = this.getRequiredResponseData(response);
        const mapped = this.mapSingle(data);
        return mapped ?? { ...payload };
      })
    );
  }

  update(payload: UserPhysicalProfile): Observable<UserPhysicalProfile> {
    return this.http.put<ApiResponse<unknown>>(`${environment.apiBaseUrl}/ObjetivoUsuario/Actualizar`, this.toApi(payload)).pipe(
      map((response) => {
        const data = this.getRequiredResponseData(response);
        const mapped = this.mapSingle(data);
        return mapped ?? payload;
      })
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/ObjetivoUsuario/Eliminar?id=${id}`).pipe(
      map((response) => {
        this.ensureSuccess(response, 'No se pudo eliminar el objetivo del usuario.');
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

  private mapCollection(payload: unknown): UserPhysicalProfile[] {
    if (!Array.isArray(payload)) {
      const single = this.mapSingle(payload);
      return single ? [single] : [];
    }

    return payload
      .map((item) => this.mapSingle(item))
      .filter((item): item is UserPhysicalProfile => item !== null);
  }

  private mapSingle(payload: unknown): UserPhysicalProfile | null {
    if (Array.isArray(payload)) {
      return payload.length > 0 ? this.mapSingle(payload[0]) : null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const dto = payload as ApiUserPhysicalProfile;
    const userId = dto.userId ?? dto.idUser ?? dto.usuarioId;

    return {
      id: dto.id != null ? String(dto.id) : dto.idObjetivoUsuario != null ? String(dto.idObjetivoUsuario) : undefined,
      userId: userId != null ? String(userId) : '',
      pesoInicio: this.toNumber(dto.pesoInicio ?? dto.pesoInicial),
      pesoObjetivo: this.toNumber(dto.pesoObjetivo),
      fechaInicio: dto.fechaInicio ?? '',
      altura: this.toNumber(dto.altura),
      pesoIdeal: this.toNumber(dto.pesoIdeal),
      imc: this.toNumber(dto.imc),
      comentario: dto.comentario ?? ''
    };
  }

  private toApi(profile: Omit<UserPhysicalProfile, 'id'> | UserPhysicalProfile): ApiUserPhysicalProfile {
    return {
      id: 'id' in profile ? profile.id : undefined,
      userId: profile.userId,
      pesoInicio: profile.pesoInicio,
      pesoObjetivo: profile.pesoObjetivo,
      fechaInicio: profile.fechaInicio,
      altura: profile.altura,
      pesoIdeal: profile.pesoIdeal,
      imc: profile.imc,
      comentario: profile.comentario ?? ''
    };
  }

  private toNumber(value: string | number | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
