import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, take, tap } from 'rxjs';

import { CheckInRecord, ResourceState } from '../../../core/models/gym.models';
import { CheckinApiService } from './checkin-api.service';

@Injectable({ providedIn: 'root' })
export class CheckinStore {
  private readonly stateSubject = new BehaviorSubject<ResourceState<CheckInRecord[]>>({ data: [], loading: false, error: null });

  readonly vm$ = this.stateSubject.asObservable();

  constructor(private readonly api: CheckinApiService) {}

  load(): void {
    this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

    this.api
      .getRecent()
      .pipe(
        take(1),
        catchError(() => {
          this.stateSubject.next({ data: [], loading: false, error: 'No se pudieron cargar los check-ins.' });
          return of([]);
        })
      )
      .subscribe((data) => this.stateSubject.next({ data, loading: false, error: null }));
  }

  create(payload: Omit<CheckInRecord, 'id'>): Observable<CheckInRecord> {
    return this.api.create(payload).pipe(tap(() => this.load()));
  }
}