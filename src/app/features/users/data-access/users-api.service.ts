
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, UserRecord } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';

interface UserApiDto {
  idUser: number;
  usuario: string;
  password: string;
  newPassword: string | null;
  idRol: number;
  idUbicacion: number;
  nombre: string;
  telefono: string;
  correo: string;
  membershipStatus: UserRecord['membershipStatus'];
  active: boolean;
  ultimoAcceso: string;
  visible: boolean;
  idEmpresa: number;
  expiredTime: string;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly mockEnabled = false;
  private mockUsers: UserRecord[] = [
    {
      id: 'user-1',
      nombre: 'Ana Martinez',
      Correo: 'ana@ngbeargym.com',
      Telefono: '+52 555 0101',
      usuario: 'ana',
      password: '123456',
      idRol: 1, // Trainer
      idEmpresa: 1,
      membershipStatus: 'Active',
      active: true,
      joinedAt: new Date('2025-10-10').toISOString()
    }
  ];

  getByEmpresa(idEmpresa: number): Observable<UserRecord[]> {
    if (this.mockEnabled) {
      return of(this.mockUsers.filter((user) => (user.idEmpresa ?? 0) === idEmpresa)).pipe(delay(350));
    }

    const params = new HttpParams().set('idEmpresa', String(idEmpresa));
    return this.http.get<ApiResponse<UserApiDto[]>>(`${environment.apiBaseUrl}/Usuarios/ConsultaByEmpresa`, { params }).pipe(
      map((res) => this.getResponseData(res, []).map((item) => this.fromApiDto(item)))
    );
  }

  getAll(): Observable<UserRecord[]> {
    if (this.mockEnabled) {
      return of([...this.mockUsers]).pipe(delay(350));
    }

    return this.http.get<ApiResponse<UserApiDto[]>>(`${environment.apiBaseUrl}/Usuarios/Consulta`).pipe(
      map((res) => this.getResponseData(res, []).map((item) => this.fromApiDto(item)))
    );
  }

  create(payload: UserRecord): Observable<UserRecord> {
    if (this.mockEnabled) {
      this.mockUsers = [...this.mockUsers, payload];
      return of(payload).pipe(delay(250));
    }

    const apiPayload = this.toApiDto(payload);
    return this.http.post<ApiResponse<UserApiDto>>(`${environment.apiBaseUrl}/Usuarios/Agrega`, apiPayload).pipe(
      map((res) => this.fromApiDto(this.getRequiredResponseData(res)))
    );
  }

  update(payload: UserRecord): Observable<UserRecord> {
    if (this.mockEnabled) {
      this.mockUsers = this.mockUsers.map((item) => (item.id === payload.id ? payload : item));
      return of(payload).pipe(delay(250));
    }

    const apiPayload = this.toApiDto(payload);
    return this.http.put<ApiResponse<UserApiDto>>(`${environment.apiBaseUrl}/Usuarios/Actualiza/`, apiPayload).pipe(
      map((res) => this.fromApiDto(this.getRequiredResponseData(res)))
    );
  }

  remove(payload: UserRecord): Observable<void> {
    if (this.mockEnabled) {
      this.mockUsers = this.mockUsers.filter((item) => item.id !== payload.id);
      return of(void 0).pipe(delay(200));
    }

    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/Usuarios/Elimina/`, { body: this.toApiDto(payload) }).pipe(
      map((res) => {
        this.ensureSuccess(res, 'No se pudo eliminar el usuario.');
        return void 0;
      })
    );
  }

    getById(id: string): Observable<any> {
  //  const params = new HttpParams().set('idUser', id);
    return this.http.get<ApiResponse<UserApiDto[]>>(`${environment.apiBaseUrl}/Usuarios/ConsultaById?id=${id}`).pipe(
      map((res) => {
        //console.log('API response for getById:', res.respuesta);
       // const data = this.getResponseData(res, []);
        //if (!data.length) throw new Error('Usuario no encontrado');
        return res.respuesta;
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

  private fromApiDto(dto: UserApiDto): UserRecord {
    return {
      id: String(dto.idUser),
      nombre: dto.nombre,
      Correo: dto.correo,
      Telefono: dto.telefono,
      usuario: dto.usuario,
      password: dto.password,
      newPassword: dto.newPassword,
      idRol: dto.idRol,
      idUbicacion: dto.idUbicacion,
      membershipStatus: dto.membershipStatus,
      active: dto.active,
      ultimoAcceso: dto.ultimoAcceso,
      visible: dto.visible,
      idEmpresa: dto.idEmpresa,
      expiredTime: dto.expiredTime,
      joinedAt: dto.ultimoAcceso || new Date().toISOString()
    };
  }

  private toApiDto(record: UserRecord): UserApiDto {
    const now = new Date().toISOString();
    const sessionEmpresaId = this.authService.snapshot?.user.idEmpresa;
    return {
      idUser: Number(record.id) || 0,
      usuario: record.usuario,
      password: record.password,
      newPassword: record.newPassword ?? null,
      idRol: record.idRol,
      idUbicacion: record.idUbicacion ?? 1,
      nombre: record.nombre,
      telefono: record.Telefono,
      correo: record.Correo,
      membershipStatus: record.membershipStatus,
      active: record.active,
      ultimoAcceso: record.ultimoAcceso ?? record.joinedAt ?? now,
      visible: record.visible ?? true,
      idEmpresa: record.idEmpresa ?? sessionEmpresaId ?? 1,
      expiredTime: record.expiredTime ?? record.joinedAt ?? now
    };
  }
}