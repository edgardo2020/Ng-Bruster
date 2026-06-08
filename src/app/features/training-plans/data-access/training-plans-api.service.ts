import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, TrainingPlan } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';

interface TrainingPlanRequest {
  id?: number;
  EntrenadorId?: string;
  name: string;
  durationWeeks: number;
  objective: string;
  schedule: Array<{
    id?: number;
    week: number;
    day: string;
    routineId: number;
    routineName: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class TrainingPlansApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly mockEnabled = false;
  private mockPlans: TrainingPlan[] = [
    {
      id: 'plan-1',
      name: 'Hipertrofia 8 semanas',
      durationWeeks: 8,
      objective: 'Ganar masa muscular con progresion de volumen.',
      schedule: [
        { id: 'schedule-1', week: 1, day: 'Monday', routineId: 'routine-1', routineName: 'Fuerza Tren Superior' },
        { id: 'schedule-2', week: 1, day: 'Wednesday', routineId: 'routine-2', routineName: 'Piernas Base' }
      ]
    }
  ];

  getAll(): Observable<TrainingPlan[]> {
    if (this.mockEnabled) {
      return of([...this.mockPlans]).pipe(delay(260));
    }

    const entrenadorId = this.getEntrenadorId();
    const hasValidEntrenadorId = !!entrenadorId;
    const endpoint = hasValidEntrenadorId
      ? `${environment.apiBaseUrl}/TrainingPlans/ConsultaByEntrenadorId`
      : `${environment.apiBaseUrl}/TrainingPlans/Consulta`;
    const options = hasValidEntrenadorId
      ? { params: new HttpParams().set('entrenadorId', entrenadorId) }
      : undefined;

    return this.http.get<ApiResponse<TrainingPlan[]>>(endpoint, options).pipe(
      map((res) => res.respuesta ?? [])
    );
  }

  private getEntrenadorId(): string | undefined {
    const userId = this.authService.snapshot?.user.id;
    return userId && userId.trim().length > 0 ? userId : undefined;
  }

  private toIdNumber(id: string): number {
    const parsed = Number(id);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toCreateRequest(payload: TrainingPlan): TrainingPlanRequest {
    return {
      EntrenadorId: this.getEntrenadorId(),
      name: payload.name,
      durationWeeks: payload.durationWeeks,
      objective: payload.objective,
      schedule: payload.schedule.map((item) => ({
        week: item.week,
        day: item.day,
        routineId: this.toIdNumber(item.routineId),
        routineName: item.routineName
      }))
    };
  }

  private toUpdateRequest(payload: TrainingPlan): TrainingPlanRequest {
    return {
      id: this.toIdNumber(payload.id),
      EntrenadorId: this.getEntrenadorId(),
      name: payload.name,
      durationWeeks: payload.durationWeeks,
      objective: payload.objective,
      schedule: payload.schedule.map((item) => ({
        id: this.toIdNumber(item.id),
        week: item.week,
        day: item.day,
        routineId: this.toIdNumber(item.routineId),
        routineName: item.routineName
      }))
    };
  }

  create(payload: TrainingPlan): Observable<TrainingPlan> {
    if (this.mockEnabled) {
      this.mockPlans = [...this.mockPlans, payload];
      return of(payload).pipe(delay(220));
    }

    return this.http
      .post<ApiResponse<TrainingPlan>>(`${environment.apiBaseUrl}/TrainingPlans/Agrega`, this.toCreateRequest(payload))
      .pipe(map((res) => res.respuesta!));
  }

  update(payload: TrainingPlan): Observable<TrainingPlan> {
    if (this.mockEnabled) {
      this.mockPlans = this.mockPlans.map((item) => (item.id === payload.id ? payload : item));
      return of(payload).pipe(delay(220));
    }

    return this.http
      .put<ApiResponse<TrainingPlan>>(`${environment.apiBaseUrl}/TrainingPlans/Actualiza`, this.toUpdateRequest(payload))
      .pipe(map((res) => res.respuesta!));
  }

  remove(id: string): Observable<void> {
    if (this.mockEnabled) {
      this.mockPlans = this.mockPlans.filter((item) => item.id !== id);
      return of(void 0).pipe(delay(190));
    }

    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/TrainingPlans/Elimina?id=${id}`).pipe(
      map(() => void 0)
    );
  }
}
