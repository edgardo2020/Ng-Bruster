import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, of, take } from 'rxjs';

import { DashboardSummary, ResourceState } from '../../../core/models/gym.models';
import { DashboardApiService } from './dashboard-api.service';

const emptySummary: DashboardSummary = {
  activeUsers: 0,
  monthlyRevenue: 0,
  attendanceRate: 0,
  monthlyGrowth: 0,
  recentCheckins: [],
  revenueSeries: [],
  attendanceSeries: []
};

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly stateSubject = new BehaviorSubject<ResourceState<DashboardSummary>>({
    data: emptySummary,
    loading: false,
    error: null
  });

  readonly vm$ = this.stateSubject.asObservable();

  constructor(private readonly api: DashboardApiService) {}

  load(): void {
    this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

    this.api
      .getSummary()
      .pipe(
        take(1),
        catchError(() => {
          this.stateSubject.next({ data: emptySummary, loading: false, error: 'No se pudo cargar el dashboard.' });
          return of(emptySummary);
        })
      )
      .subscribe((data) => this.stateSubject.next({ data, loading: false, error: null }));
  }
}