import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, CheckInRecord } from '../../../core/models/gym.models';

@Injectable({ providedIn: 'root' })
export class CheckinApiService {
  private readonly http = inject(HttpClient);
  private readonly mockEnabled = true;
  private mockCheckins: CheckInRecord[] = [
/*    {
      id: 'checkin-1',
      userName: 'Ana Martinez',
      membershipName: 'Premium',
      checkInAt: new Date(Date.now() - 10 * 60000).toISOString(),
      channel: 'QR'
    },
    {
      id: 'checkin-2',
      userName: 'Carlos Ruiz',
      membershipName: 'Basic',
      checkInAt: new Date(Date.now() - 35 * 60000).toISOString(),
      channel: 'Manual'
    }*/
  ];

  getRecent(): Observable<CheckInRecord[]> {
    if (this.mockEnabled) {
      return of([...this.mockCheckins]).pipe(delay(280));
    }

    return this.http.get<ApiResponse<CheckInRecord[]>>(`${environment.apiBaseUrl}/api/checkins`).pipe(
      map((res) => res.respuesta ?? [])
    );
  }

  create(payload: Omit<CheckInRecord, 'id'>): Observable<CheckInRecord> {
    if (this.mockEnabled) {
      const created: CheckInRecord = { id: crypto.randomUUID(), ...payload };
      this.mockCheckins = [created, ...this.mockCheckins];
      return of(created).pipe(delay(220));
    }

    return this.http.post<ApiResponse<CheckInRecord>>(`${environment.apiBaseUrl}/api/checkins`, payload).pipe(
      map((res) => res.respuesta!)
    );
  }
}