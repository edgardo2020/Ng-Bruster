import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, ExerciseCatalogItem, MuscleGroup } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';

const MUSCLE_GROUP_TO_INT: Record<MuscleGroup, number> = {
  Chest: 1, Back: 2, Shoulders: 3, Arms: 4, Legs: 5, Core: 6, FullBody: 7, Cardio: 8
};

const INT_TO_MUSCLE_GROUP: Record<number, MuscleGroup> = {
  1: 'Chest', 2: 'Back', 3: 'Shoulders', 4: 'Arms', 5: 'Legs', 6: 'Core', 7: 'FullBody', 8: 'Cardio'
};

type ApiExercise = Omit<ExerciseCatalogItem, 'muscleGroup' | 'muscleGroupCatalogId'> & {
  muscleGroup: number;
  MuscleGroupCatalogId?: number;
  idEmpresa?: number;
  ImageBase64?: string;
  muscleGroupCatalog?: {
    id?: number;
    description?: string;
  };
};

@Injectable({ providedIn: 'root' })
export class ExercisesApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly mockEnabled = false;
  private mockExercises: ExerciseCatalogItem[] = [
    {
      id: 'exercise-1',
      name: 'Bench Press',
      description: 'Movimiento compuesto para pectoral y triceps.',
      muscleGroup: 'Chest'

    },
    {
      id: 'exercise-2',
      name: 'Back Squat',
      description: 'Sentadilla trasera para fuerza de piernas y core.',
      muscleGroup: 'Legs'
    }
  ];

  getAll(): Observable<ExerciseCatalogItem[]> {
    if (this.mockEnabled) {
      return of([...this.mockExercises]).pipe(delay(280));
    }

    const companyId = this.authService.snapshot?.user.idEmpresa;
    const hasValidCompanyId = Number.isFinite(companyId) && Number(companyId) > 0;
    const endpoint = hasValidCompanyId
      ? `${environment.apiBaseUrl}/Exercises/ConsultaByIdEmpresa`
      : `${environment.apiBaseUrl}/Exercises/Consulta`;
    const options = hasValidCompanyId
      ? { params: new HttpParams().set('idEmpresa', String(companyId)) }
      : undefined;

    return this.http.get<ApiResponse<ApiExercise[]>>(endpoint, options).pipe(
      map((res) => this.getResponseData(res, []).map((e) => this.fromApi(e)))
    );
  }

  create(payload: ExerciseCatalogItem): Observable<ExerciseCatalogItem> {
    if (this.mockEnabled) {
      this.mockExercises = [...this.mockExercises, payload];
      return of(payload).pipe(delay(200));
    }

    return this.http.post<ApiResponse<ApiExercise>>(`${environment.apiBaseUrl}/Exercises/Agrega`, this.toApi(payload)).pipe(
      map((res) => {
        const data = this.getResponseData(res, null);
        return data ? this.fromApi(data) : payload;
      })
    );
  }

  update(payload: ExerciseCatalogItem): Observable<ExerciseCatalogItem> {
    if (this.mockEnabled) {
      this.mockExercises = this.mockExercises.map((item) => (item.id === payload.id ? payload : item));
      return of(payload).pipe(delay(200));
    }

    return this.http.put<ApiResponse<ApiExercise>>(`${environment.apiBaseUrl}/Exercises/Actualiza`, this.toApi(payload)).pipe(
      map((res) => {
        const data = this.getResponseData(res, null);
        return data ? this.fromApi(data) : payload;
      })
    );
  }

  remove(id: string): Observable<void> {
    if (this.mockEnabled) {
      this.mockExercises = this.mockExercises.filter((item) => item.id !== id);
      return of(void 0).pipe(delay(180));
    }

    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/Exercises/Elimina?id=${id}`).pipe(
      map((res) => {
        this.ensureSuccess(res, 'No se pudo eliminar el ejercicio.');
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

  private toApi(item: ExerciseCatalogItem): ApiExercise {
    const resolvedMuscleGroupId = item.muscleGroupCatalogId ?? MUSCLE_GROUP_TO_INT[item.muscleGroup];
    const companyId = this.authService.snapshot?.user.idEmpresa;
    const hasValidCompanyId = Number.isFinite(companyId) && Number(companyId) > 0;

    const apiItem: ApiExercise = {
      id: item.id,
      name: item.name,
      description: item.description,
      muscleGroup: resolvedMuscleGroupId,
      MuscleGroupCatalogId: resolvedMuscleGroupId,
      ImageBase64: item.ImageBase64
    };

    if (hasValidCompanyId) {
      apiItem.idEmpresa = Number(companyId);
    }

    return apiItem;
  }

  private fromApi(item: ApiExercise): ExerciseCatalogItem {
    const resolvedMuscleGroupId = item.MuscleGroupCatalogId ?? item.muscleGroup;
    const mappedMuscleGroupCatalog = item.muscleGroupCatalog
      ? {
          id: Number(item.muscleGroupCatalog.id ?? resolvedMuscleGroupId ?? 0),
          description: item.muscleGroupCatalog.description ?? ''
        }
      : undefined;

    const rawItem = item as ApiExercise & { imageBase64?: string };
    const resolvedImage = rawItem.ImageBase64 ?? rawItem.imageBase64;

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      muscleGroup: INT_TO_MUSCLE_GROUP[resolvedMuscleGroupId] ?? 'Chest',
      muscleGroupCatalogId: resolvedMuscleGroupId,
      muscleGroupCatalog: mappedMuscleGroupCatalog,
      ...(resolvedImage ? { ImageBase64: resolvedImage } : {})
    };
  }
}
