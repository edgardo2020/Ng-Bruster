import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, take, tap } from 'rxjs';

import { ResourceState, Routine } from '../../../core/models/gym.models';
import { RoutinesApiService } from './routines-api.service';

@Injectable({ providedIn: 'root' })
export class RoutinesStore {
  private readonly stateSubject = new BehaviorSubject<ResourceState<Routine[]>>({ data: [], loading: false, error: null });

  readonly vm$ = this.stateSubject.asObservable();

  constructor(private readonly api: RoutinesApiService) {}

  load(): void {
    this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

    this.api
      .getAll()
      .pipe(
        take(1),
        catchError(() => {
          this.stateSubject.next({ data: [], loading: false, error: 'No se pudieron cargar las rutinas.' });
          return of([]);
        })
      )
      .subscribe((data) => this.stateSubject.next({ data, loading: false, error: null }));
  }

  create(payload: Routine): Observable<Routine> {
    return this.api.create(payload).pipe(tap(() => this.load()));
  }

  update(payload: Routine): Observable<Routine> {
    return this.api.update(payload).pipe(tap(() => this.load()));
  }

  remove(id: string): Observable<void> {
    return this.api.remove(id).pipe(tap(() => this.load()));
  }
}