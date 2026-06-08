import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, take, tap } from 'rxjs';

import { ExerciseCatalogItem, ResourceState } from '../../../core/models/gym.models';
import { ExercisesApiService } from './exercises-api.service';

@Injectable({ providedIn: 'root' })
export class ExercisesStore {
  private readonly stateSubject = new BehaviorSubject<ResourceState<ExerciseCatalogItem[]>>({ data: [], loading: false, error: null });

  readonly vm$ = this.stateSubject.asObservable();

  constructor(private readonly api: ExercisesApiService) {}

  load(): void {
    this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

    this.api
      .getAll()
      .pipe(
        take(1),
        catchError(() => {
          this.stateSubject.next({ data: [], loading: false, error: 'No se pudieron cargar los ejercicios.' });
          return of([]);
        })
      )
      .subscribe((data) => this.stateSubject.next({ data, loading: false, error: null }));
  }

  create(payload: ExerciseCatalogItem): Observable<ExerciseCatalogItem> {
    return this.api.create(payload).pipe(tap(() => this.load()));
  }

  update(payload: ExerciseCatalogItem): Observable<ExerciseCatalogItem> {
    return this.api.update(payload).pipe(tap(() => this.load()));
  }

  remove(id: string): Observable<void> {
    return this.api.remove(id).pipe(tap(() => this.load()));
  }
}
