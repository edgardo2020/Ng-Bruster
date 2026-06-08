import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, ChartPoint, DashboardSummary } from '../../../core/models/gym.models';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly mockEnabled = true;

  getSummary(): Observable<DashboardSummary> {
    // Mock temporal para probar el flujo sin backend
    if (this.mockEnabled) {
      const mockSummary: DashboardSummary = {
        activeUsers: 248,
        monthlyRevenue: 12500,
        attendanceRate: 87.5,
        monthlyGrowth: 12.3,
        recentCheckins: [
          { id: '1', userName: 'Juan García', membershipName: 'Premium', checkInAt: new Date(Date.now() - 5 * 60000).toISOString(), channel: 'QR' },
          { id: '2', userName: 'María López', membershipName: 'Standard', checkInAt: new Date(Date.now() - 15 * 60000).toISOString(), channel: 'Manual' },
          { id: '3', userName: 'Carlos Ruiz', membershipName: 'Premium', checkInAt: new Date(Date.now() - 25 * 60000).toISOString(), channel: 'QR' },
          { id: '4', userName: 'Ana Martínez', membershipName: 'Basic', checkInAt: new Date(Date.now() - 45 * 60000).toISOString(), channel: 'Manual' }
        ],
        revenueSeries: this.generateChartData('Ingresos'),
        attendanceSeries: this.generateChartData('Asistencia')
      };

      return of(mockSummary).pipe(delay(600));
    }

    return this.http.get<ApiResponse<DashboardSummary>>(`${environment.apiBaseUrl}/api/dashboard/summary`).pipe(
      map((res) => res.respuesta!)
    );
  }

  private generateChartData(label: string): ChartPoint[] {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    return months.map((month) => ({
      label: month,
      value: Math.floor(Math.random() * (15000 - 8000 + 1)) + 8000
    }));
  }
}