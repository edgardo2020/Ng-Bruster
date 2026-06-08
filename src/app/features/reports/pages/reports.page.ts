import { AsyncPipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';

import { ChartPoint } from '../../../core/models/gym.models';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { ReportsStore } from '../data-access/reports.store';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DecimalPipe, PageHeaderComponent],
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss'
})
export class ReportsPageComponent implements OnInit {
  readonly store = inject(ReportsStore);

  ngOnInit(): void {
    this.store.load();
  }

  getBarHeight(value: number, series: ChartPoint[]): number {
    const maxValue = Math.max(...series.map((point) => point.value), 1);
    const normalized = (value / maxValue) * 100;
    return Math.min(100, Math.max(6, normalized));
  }
}