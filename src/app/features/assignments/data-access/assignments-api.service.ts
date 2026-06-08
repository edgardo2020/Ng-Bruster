import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, ExerciseCatalogItem, NewUserPlanAssignment, UserPlanAssignment } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';

export interface AssignmentDetailExercise extends ExerciseCatalogItem {
  assignedSets?: number;
  assignedReps?: number;
  assignedWeight?: number;
  isFinished?: boolean;
  sets?: number;
  reps?: number;
  weight?: number;
}

export interface AssignmentDetailAgendaItem {
  week?: number;
  day: string;
  routineId?: string | number;
  exercises: AssignmentDetailExercise[];
}

export interface AssignmentDetail {
  id: number;
  userId: string;
  userName: string;
  planId: string;
  planName: string;
  startDate: string;
  durationWeeks?: number;
  isCustomized?: boolean;
  focus?: string;
  intensity?: string;
  notes?: string;
  agenda?: AssignmentDetailAgendaItem[];
}

export type AssignmentDetailUpdateRequest = AssignmentDetail;

@Injectable({ providedIn: 'root' })
export class AssignmentsApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly mockEnabled = false;
  private mockAssignments: UserPlanAssignment[] = [
    {
      id: 1,
      userId: 'user-1',
      userName: 'Ana Martinez',
      planId: 'plan-1',
      planName: 'Hipertrofia 8 semanas',
      startDate: new Date('2026-01-06').toISOString(),
      isCustomized: false
    }
  ];

  getAll(): Observable<UserPlanAssignment[]> {
    if (this.mockEnabled) {
      return of([...this.mockAssignments]).pipe(delay(240));
    }

    const entrenadorId = this.getEntrenadorId();
    const endpoint = entrenadorId
      ? `${environment.apiBaseUrl}/Assignments/ConsultaByEntrenadorId`
      : `${environment.apiBaseUrl}/Assignments/Consulta`;
    const options = entrenadorId
      ? { params: new HttpParams().set('entrenadorId', entrenadorId) }
      : undefined;

    return this.http.get<ApiResponse<UserPlanAssignment[]>>(endpoint, options).pipe(
      map((res) => res.respuesta ?? [])
    );
  }

  private getEntrenadorId(): string | undefined {
    const userId = this.authService.snapshot?.user.id;
    return userId && userId.trim().length > 0 ? userId : undefined;
  }

  getDetail(id: number): Observable<AssignmentDetail> {
    if (this.mockEnabled) {
      const assignment = this.mockAssignments.find((item) => item.id === id);
      const detail: AssignmentDetail = {
        id,
        userId: assignment?.userId ?? '',
        userName: assignment?.userName ?? '',
        planId: assignment?.planId ?? '',
        planName: assignment?.planName ?? '',
        startDate: assignment?.startDate ?? new Date().toISOString(),
        isCustomized: assignment?.isCustomized ?? false,
        agenda: []
      };

      return of(detail).pipe(delay(200));
    }

    return this.http
      .get<ApiResponse<AssignmentDetail>>(`${environment.apiBaseUrl}/Assignments/ConsultaDetalle?id=${id}`)
      .pipe(map((res) => res.respuesta as AssignmentDetail));
  }

  getDetailByUser(userId: string): Observable<AssignmentDetail[]> {
    if (this.mockEnabled) {
      return of([]).pipe(delay(200));
    }

    const params = new HttpParams().set('userId', userId);
    return this.http
      .get<ApiResponse<AssignmentDetail[]>>(`${environment.apiBaseUrl}/Assignments/ConsultaDetallePorUsuario`, { params })
      .pipe(map((res) => (res.respuesta ?? []).map((detail) => this.normalizeDetail(detail))));
  }

  updateDetail(payload: AssignmentDetailUpdateRequest): Observable<AssignmentDetail> {
    if (this.mockEnabled) {
      return of(payload).pipe(delay(200));
    }

    return this.http
      .put<ApiResponse<AssignmentDetail>>(`${environment.apiBaseUrl}/Assignments/ActualizaDetalle`, payload)
      .pipe(map((res) => (res.respuesta as AssignmentDetail) ?? payload));
  }

  create(payload: NewUserPlanAssignment): Observable<UserPlanAssignment> {
    if (this.mockEnabled) {
      const created: UserPlanAssignment = {
        ...payload,
        id: Date.now()
      };
      this.mockAssignments = [...this.mockAssignments, created];
      return of(created).pipe(delay(200));
    }

    const entrenadorId = this.getEntrenadorId();
    const body = entrenadorId ? { ...payload, EntrenadorId: entrenadorId } : payload;
    return this.http.post<ApiResponse<UserPlanAssignment>>(`${environment.apiBaseUrl}/Assignments/Agrega`, body).pipe(
      map((res) => res.respuesta!)
    );
  }

  update(payload: UserPlanAssignment): Observable<UserPlanAssignment> {
    if (this.mockEnabled) {
      this.mockAssignments = this.mockAssignments.map((item) => (item.id === payload.id ? payload : item));
      return of(payload).pipe(delay(200));
    }

    return this.http.put<ApiResponse<UserPlanAssignment>>(`${environment.apiBaseUrl}/Assignments/Actualiza/`, payload).pipe(
      map((res) => res.respuesta!)
    );
  }

  remove(id: number): Observable<void> {
    if (this.mockEnabled) {
      this.mockAssignments = this.mockAssignments.filter((item) => item.id !== id);
      return of(void 0).pipe(delay(180));
    }

    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/Assignments/Elimina?id=${id}`).pipe(
      map(() => void 0)
    );
  }

  private normalizeDetail(detail: AssignmentDetail): AssignmentDetail {
    return {
      ...detail,
      agenda: (detail.agenda ?? []).map((agendaItem) => ({
        ...agendaItem,
        exercises: (agendaItem.exercises ?? []).map((ex) => {
          const raw = ex as AssignmentDetailExercise & Record<string, unknown>;
          const imageBase64 =
            (raw['ImageBase64'] as string | undefined) ??
            (raw['imageBase64'] as string | undefined) ??
            (raw['image_base64'] as string | undefined);
          return imageBase64 ? { ...ex, ImageBase64: imageBase64 } : ex;
        })
      }))
    };
  }
}
