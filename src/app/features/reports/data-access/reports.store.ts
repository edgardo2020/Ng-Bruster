import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, of, take } from 'rxjs';

import { ReportSnapshot, ResourceState } from '../../../core/models/gym.models';
import { ReportsApiService } from './reports-api.service';

const emptySnapshot: ReportSnapshot = {
  attendanceByDay: [],
  revenueByMonth: [],
  activeMemberships: []
};

@Injectable({ providedIn: 'root' })
export class ReportsStore {
  private readonly stateSubject = new BehaviorSubject<ResourceState<ReportSnapshot>>({
    data: emptySnapshot,
    loading: false,
    error: null
  });

  readonly vm$ = this.stateSubject.asObservable();

  constructor(private readonly api: ReportsApiService) {}

  load(): void {
    this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

    this.api
      .getSnapshot()
      .pipe(
        take(1),
        catchError(() => {
          this.stateSubject.next({ data: emptySnapshot, loading: false, error: 'No se pudieron cargar los reportes.' });
          return of(emptySnapshot);
        })
      )
      .subscribe((data) => this.stateSubject.next({ data, loading: false, error: null }));
  }
}