import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Membership } from '../../../core/models/gym.models';

@Injectable({ providedIn: 'root' })
export class MembershipsApiService {
  private readonly http = inject(HttpClient);
  private readonly mockEnabled = true;
  private mockMemberships: Membership[] = [
    {
      id: 'membership-1',
      name: 'Basic',
      price: 29,
      durationInDays: 30,
      status: 'Active',
      benefits: ['General access']
    },
    {
      id: 'membership-2',
      name: 'Premium',
      price: 59,
      durationInDays: 30,
      status: 'Active',
      benefits: ['General access', 'Classes included', 'Nutrition support']
    },
    {
      id: 'membership-3',
      name: 'Quarterly',
      price: 149,
      durationInDays: 90,
      status: 'Cancelled',
      benefits: ['General access', 'Discounted classes']
    }
  ];

  getAll(): Observable<Membership[]> {
    if (this.mockEnabled) {
      return of([...this.mockMemberships]).pipe(delay(300));
    }

    return this.http.get<ApiResponse<Membership[]>>(`${environment.apiBaseUrl}/api/memberships`).pipe(
      map((res) => res.respuesta ?? [])
    );
  }

  create(payload: Membership): Observable<Membership> {
    if (this.mockEnabled) {
      this.mockMemberships = [...this.mockMemberships, payload];
      return of(payload).pipe(delay(220));
    }

    return this.http.post<ApiResponse<Membership>>(`${environment.apiBaseUrl}/api/memberships`, payload).pipe(
      map((res) => res.respuesta!)
    );
  }

  update(payload: Membership): Observable<Membership> {
    if (this.mockEnabled) {
      this.mockMemberships = this.mockMemberships.map((item) => (item.id === payload.id ? payload : item));
      return of(payload).pipe(delay(220));
    }

    return this.http.put<ApiResponse<Membership>>(`${environment.apiBaseUrl}/api/memberships/${payload.id}`, payload).pipe(
      map((res) => res.respuesta!)
    );
  }

  remove(id: string): Observable<void> {
    if (this.mockEnabled) {
      this.mockMemberships = this.mockMemberships.filter((item) => item.id !== id);
      return of(void 0).pipe(delay(180));
    }

    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/api/memberships/${id}`).pipe(
      map(() => void 0)
    );
  }
}