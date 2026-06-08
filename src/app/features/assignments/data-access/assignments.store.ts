import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, take, tap } from 'rxjs';

import { NewUserPlanAssignment, ResourceState, UserPlanAssignment } from '../../../core/models/gym.models';
import { AssignmentDetail, AssignmentDetailUpdateRequest, AssignmentsApiService } from './assignments-api.service';

@Injectable({ providedIn: 'root' })
export class AssignmentsStore {
  private readonly stateSubject = new BehaviorSubject<ResourceState<UserPlanAssignment[]>>({ data: [], loading: false, error: null });

  readonly vm$ = this.stateSubject.asObservable();

  constructor(private readonly api: AssignmentsApiService) {}

  load(): void {
    this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

    this.api
      .getAll()
      .pipe(
        take(1),
        catchError(() => {
          this.stateSubject.next({ data: [], loading: false, error: 'No se pudieron cargar las asignaciones.' });
          return of([]);
        })
      )
      .subscribe((data) => this.stateSubject.next({ data: this.ensureArray(data), loading: false, error: null }));
  }

  private ensureArray(value: unknown): UserPlanAssignment[] {
    return Array.isArray(value) ? value : [];
  }

  create(payload: NewUserPlanAssignment): Observable<UserPlanAssignment> {
    return this.api.create(payload).pipe(tap(() => this.load()));
  }

  getDetail(id: number): Observable<AssignmentDetail> {
    return this.api.getDetail(id);
  }

  getDetailByUser(userId: string): Observable<AssignmentDetail[]> {
    return this.api.getDetailByUser(userId);
  }

  updateDetail(payload: AssignmentDetailUpdateRequest): Observable<AssignmentDetail> {
    return this.api.updateDetail(payload);
  }

  update(payload: UserPlanAssignment): Observable<UserPlanAssignment> {
    return this.api.update(payload).pipe(tap(() => this.load()));
  }

  remove(id: number): Observable<void> {
    return this.api.remove(id).pipe(tap(() => this.load()));
  }
}
