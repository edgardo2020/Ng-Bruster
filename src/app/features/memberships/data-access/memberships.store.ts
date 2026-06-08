import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, take, tap } from 'rxjs';

import { Membership, ResourceState } from '../../../core/models/gym.models';
import { MembershipsApiService } from './memberships-api.service';

@Injectable({ providedIn: 'root' })
export class MembershipsStore {
  private readonly stateSubject = new BehaviorSubject<ResourceState<Membership[]>>({ data: [], loading: false, error: null });

  readonly vm$ = this.stateSubject.asObservable();

  constructor(private readonly api: MembershipsApiService) {}

  load(): void {
    this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

    this.api
      .getAll()
      .pipe(
        take(1),
        catchError(() => {
          this.stateSubject.next({ data: [], loading: false, error: 'No se pudieron cargar las membresías.' });
          return of([]);
        })
      )
      .subscribe((data) => this.stateSubject.next({ data, loading: false, error: null }));
  }

  create(payload: Membership): Observable<Membership> {
    return this.api.create(payload).pipe(tap(() => this.load()));
  }

  update(payload: Membership): Observable<Membership> {
    return this.api.update(payload).pipe(tap(() => this.load()));
  }

  remove(id: string): Observable<void> {
    return this.api.remove(id).pipe(tap(() => this.load()));
  }
}