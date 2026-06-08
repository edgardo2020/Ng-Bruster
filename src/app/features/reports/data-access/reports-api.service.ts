import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, ReportSnapshot } from '../../../core/models/gym.models';

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly mockEnabled = true;

  getSnapshot(): Observable<ReportSnapshot> {
    if (this.mockEnabled) {
      const snapshot: ReportSnapshot = {
        attendanceByDay: [
          { label: 'Mon', value: 82 },
          { label: 'Tue', value: 88 },
          { label: 'Wed', value: 91 },
          { label: 'Thu', value: 85 },
          { label: 'Fri', value: 93 },
          { label: 'Sat', value: 76 },
          { label: 'Sun', value: 61 }
        ],
        revenueByMonth: [
          { label: 'Jan', value: 9800 },
          { label: 'Feb', value: 10300 },
          { label: 'Mar', value: 11100 },
          { label: 'Apr', value: 12400 },
          { label: 'May', value: 11900 },
          { label: 'Jun', value: 12750 }
        ],
        activeMemberships: [
          { label: 'Basic', value: 110 },
          { label: 'Premium', value: 84 },
          { label: 'Quarterly', value: 37 }
        ]
      };

      return of(snapshot).pipe(delay(350));
    }

    return this.http.get<ApiResponse<ReportSnapshot>>(`${environment.apiBaseUrl}/api/reports/summary`).pipe(
      map((res) => res.respuesta!)
    );
  }
}