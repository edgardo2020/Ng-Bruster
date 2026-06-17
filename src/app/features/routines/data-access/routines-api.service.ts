import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Routine, RoutineExercise } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';

type ApiRoutine = Partial<Routine> & {
  id?: string | number;
  name?: string;
  description?: string;
  isCustomized?: boolean | string | number;
  //IsCustomized?: boolean | string | number;
  planId?: string | number;
  //PlanId?: string | number;
  week?: number | string;
 // Week?: number | string;
  day?: string;
  Day?: string;
  exercises?: unknown;
  exercisesList?: unknown;
  routineExercises?: unknown;
  ejercicios?: unknown;
};

type RoutineExerciseRequest = {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number;
  isFinished?: boolean;
};

type RoutineRequest = {
  id?: string;
  UserId?: string;
  EntrenadorId?: string;
  IdEmpresa?: number;
  name: string;
  description: string;
  IsCustomized?: boolean;
  PlanId?: string;
  Week?: number;
  Day?: string;
  exercises: RoutineExerciseRequest[];
};

type ApiRoutineExercise = Partial<RoutineExercise> & {
  id?: string | number;
  exerciseId?: string | number;
  exerciseName?: string;
  exerciseDescription?: string;
  description?: string;
  sets?: number | string;
  reps?: number | string;
  weight?: number | string;
  suggestedWeight?: number | string;
  isFinished?: boolean | string | number;
  exercise?: { id?: string | number; name?: string; description?: string; ImageBase64?: string; imageBase64?: string };
  nombreEjercicio?: string;
  descripcionEjercicio?: string;
  series?: number | string;
  repeticiones?: number | string;
  pesoSugerido?: number | string;
  ImageBase64?: string;
  imageBase64?: string;
};

@Injectable({ providedIn: 'root' })
export class RoutinesApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly mockEnabled = false;
  private mockRoutines: Routine[] = [

  ];

  getAll(): Observable<Routine[]> {
    const idEmpresa = this.authService.snapshot?.user.idEmpresa;
    const params = new HttpParams().set('IdEmpresa', idEmpresa ?? '');

    return this.http.get<ApiResponse<unknown[]>>(`${environment.apiBaseUrl}/Routines/ConsultaByEmpresa`, { params }).pipe(
      map((res) => this.mapRoutines(res.respuesta ?? []))
    );
  }

  getByUser(userId: string): Observable<Routine[]> {
    if (this.mockEnabled) {
      return of([...this.mockRoutines]).pipe(delay(320));
    }

    const params = new HttpParams().set('userId', userId);
    return this.http.get<ApiResponse<unknown[]>>(`${environment.apiBaseUrl}/Routines/ConsultaByUser`, { params }).pipe(
      map((res) => this.mapRoutines(res.respuesta ?? []))
    );
  }

  create(payload: Routine): Observable<Routine> {
    if (this.mockEnabled) {
      this.mockRoutines = [...this.mockRoutines, payload];
      return of(payload).pipe(delay(230));
    }

    return this.http.post<ApiResponse<Routine>>(`${environment.apiBaseUrl}/Routines/Agrega`, this.toApi(payload)).pipe(
      map((res) => {
        this.ensureSuccess(res);
        return res.respuesta!;
      })
    );
  }

  createByUser(userId: string, payload: Routine): Observable<Routine> {
    if (this.mockEnabled) {
      this.mockRoutines = [...this.mockRoutines, payload];
      return of(payload).pipe(delay(230));
    }

    const params = new HttpParams().set('userId', userId);
    const request = this.toApi(payload);
    request.UserId = userId;
    return this.http
      .post<ApiResponse<Routine>>(`${environment.apiBaseUrl}/Routines/AgregaPorUsuario`, request, { params })
      .pipe(
        map((res) => {
          this.ensureSuccess(res);
          return res.respuesta!;
        })
      );
  }

  update(payload: Routine): Observable<Routine> {
    if (this.mockEnabled) {
      this.mockRoutines = this.mockRoutines.map((item) => (item.id === payload.id ? payload : item));
      return of(payload).pipe(delay(230));
    }

    return this.http.put<ApiResponse<Routine>>(`${environment.apiBaseUrl}/Routines/Actualiza`, this.toApi(payload)).pipe(
      map((res) => {
        this.ensureSuccess(res);
        return res.respuesta!;
      })
    );
  }

  remove(id: string): Observable<void> {
    if (this.mockEnabled) {
      this.mockRoutines = this.mockRoutines.filter((item) => item.id !== id);
      return of(void 0).pipe(delay(200));
    }

    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/Routines/Elimina?id=${id}`).pipe(
      map((res) => {
        this.ensureSuccess(res);
        return void 0;
      })
    );
  }

  private ensureSuccess<T>(res: ApiResponse<T>): void {
    if (!res.exito) {
      throw new Error(res.mensaje || 'Error en la operación.');
    }
  }

  private toApi(routine: Routine): RoutineRequest {
    const user = this.authService.snapshot?.user;
    const request: RoutineRequest = {
      id: routine.id !== '0' ? routine.id : undefined,
      name: routine.name,
      description: routine.description,
      EntrenadorId: user?.id ?? undefined,
      IdEmpresa: user?.idEmpresa ?? undefined,
      exercises: routine.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        isFinished: ex.isFinished
      }))
    };

    if (routine.isCustomized) {
      request.IsCustomized = true;
    }

    if (routine.planId) {
      request.PlanId = routine.planId;
    }

    if (typeof routine.week === 'number') {
      request.Week = routine.week;
    }

    if (routine.day) {
      request.Day = routine.day;
    }

    return request;
  }

  private mapRoutines(collection: unknown[]): Routine[] {
    return collection
      .filter((item): item is ApiRoutine => !!item && typeof item === 'object')
      .map((item) => ({
        id: String(item.id ?? ''),
        name: item.name ?? '',
        description: item.description ?? '',
        isCustomized: this.toBoolean(item.isCustomized),
        planId: item.planId != null ? String(item.planId) : undefined,
        week: this.toNumberOrUndefined(item.week),
        day: item.day,
        exercises: this.mapExercises(item)
      }));
  }

  private mapExercises(item: ApiRoutine): RoutineExercise[] {
    const rawExercises = item.exercises ?? item.exercisesList ?? item.routineExercises ?? item.ejercicios;
    if (!Array.isArray(rawExercises)) {
      return [];
    }

    return rawExercises
      .filter((exercise): exercise is ApiRoutineExercise => !!exercise && typeof exercise === 'object')
      .map((exercise) => ({
        id: String(exercise.exerciseId),
        exerciseId: String(exercise.exerciseId ?? exercise.exercise?.id ?? ''),
        exerciseName: exercise.exerciseName ?? exercise.nombreEjercicio ?? exercise.exercise?.name ?? 'Ejercicio',
        exerciseDescription:
          exercise.exerciseDescription ??
          exercise.descripcionEjercicio ??
          exercise.description ??
          exercise.exercise?.description,
        isFinished: this.toBoolean(exercise.isFinished),
        sets: this.toNumber(exercise.sets ?? exercise.series, 0),
        reps: this.toNumber(exercise.reps ?? exercise.repeticiones, 0),
        weight: this.toNumber(exercise.weight ?? exercise.suggestedWeight ?? exercise.pesoSugerido, 0),
        ImageBase64: exercise.ImageBase64 ?? exercise.imageBase64 ?? exercise.exercise?.ImageBase64 ?? exercise.exercise?.imageBase64
      }));
  }

  private toNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toNumberOrUndefined(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'true' || normalized === '1';
    }

    return false;
  }
}