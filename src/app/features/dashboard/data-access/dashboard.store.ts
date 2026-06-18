import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, forkJoin, catchError, of, take } from 'rxjs';

import { CheckInRecord, DashboardSummary, ResourceState } from '../../../core/models/gym.models';
import { UsersApiService } from '../../users/data-access/users-api.service';
import { CheckinApiService } from '../../checkin/data-access/checkin-api.service';
import { AuthService } from '../../../core/services/auth.service';

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

  private readonly usersApi = inject(UsersApiService);
  private readonly checkinApi = inject(CheckinApiService);
  private readonly authService = inject(AuthService);

  load(): void {
    this.stateSubject.next({ ...this.stateSubject.value, loading: true, error: null });

    const empresaId = this.authService.snapshot?.user.idEmpresa;
    const users$ = empresaId ? this.usersApi.getByEmpresa(empresaId) : this.usersApi.getAll();

    forkJoin({
      users: users$,
      checkins: this.checkinApi.getRecent()
    }).pipe(
      take(1),
      catchError(() => {
        this.stateSubject.next({ data: emptySummary, loading: false, error: 'No se pudo cargar el dashboard.' });
        return of({ users: [], checkins: [] });
      })
    ).subscribe(({ users, checkins }) => {
      const trainees = users.filter((u) => u.idRol === 2);
      const userCheckins: CheckInRecord[] = trainees
        .filter((u) => u.joinedAt)
        .map((u) => ({
          id: u.id,
          userName: u.nombre,
          membershipName: u.membershipStatus,
          checkInAt: u.joinedAt,
          channel: 'Manual' as const
        }));

      const allCheckins = [...checkins, ...userCheckins].sort(
        (a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime()
      );

      this.stateSubject.next({
        data: {
          activeUsers: trainees.filter((u) => u.active && u.membershipStatus === 'Active').length,
          monthlyRevenue: 0,
          attendanceRate: 0,
          monthlyGrowth: 0,
          recentCheckins: allCheckins,
          revenueSeries: [],
          attendanceSeries: []
        },
        loading: false,
        error: null
      });
    });
  }
}