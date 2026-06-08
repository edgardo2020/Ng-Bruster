import { AsyncPipe, CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ChartPoint } from '../../../core/models/gym.models';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { StatCardComponent } from '../../../shared/ui/stat-card.component';
import { DashboardStore } from '../data-access/dashboard.store';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, MatButtonModule, MatIconModule, PageHeaderComponent, StatCardComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class DashboardPageComponent implements OnInit {
  readonly store = inject(DashboardStore);

  ngOnInit(): void {
    this.store.load();
  }

  reload(): void {
    this.store.load();
  }

  getBarHeight(value: number, series: ChartPoint[]): number {
    const maxValue = Math.max(...series.map((point) => point.value), 1);
    const normalized = (value / maxValue) * 100;
    return Math.min(100, Math.max(6, normalized));
  }
}