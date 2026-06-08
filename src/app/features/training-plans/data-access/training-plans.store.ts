import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, take, tap } from 'rxjs';

import { ResourceState, TrainingPlan } from '../../../core/models/gym.models';
import { TrainingPlansApiService } from './training-plans-api.service';

@Injectable({ providedIn: 'root' })
export class TrainingPlansStore {
  private readonly stateSubject = new BehaviorSubject<ResourceState<TrainingPlan[]>>({ data: [], loading: false, error: null });

  readonly vm$ = this.stateSubject.asObservable();

  constructor(private readonly api: TrainingPlansApiService) {}

  load(): void {
    this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

    this.api
      .getAll()
      .pipe(
        take(1),
        catchError(() => {
          this.stateSubject.next({ data: [], loading: false, error: 'No se pudieron cargar los planes de entrenamiento.' });
          return of([]);
        })
      )
      .subscribe((data) => this.stateSubject.next({ data, loading: false, error: null }));
  }

  create(payload: TrainingPlan): Observable<TrainingPlan> {
    return this.api.create(payload).pipe(tap(() => this.load()));
  }

  update(payload: TrainingPlan): Observable<TrainingPlan> {
    return this.api.update(payload).pipe(tap(() => this.load()));
  }

  remove(id: string): Observable<void> {
    return this.api.remove(id).pipe(tap(() => this.load()));
  }
}
