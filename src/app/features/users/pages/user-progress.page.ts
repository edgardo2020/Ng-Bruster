import { Component, ViewChild, inject, signal } from '@angular/core';
import jsPDF from 'jspdf';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, Chart, registerables } from 'chart.js';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { finalize, forkJoin, take } from 'rxjs';

import { UserPhysicalProfile, UserWeightRecord } from '../../../core/models/gym.models';
import { AuthService } from '../../../core/services/auth.service';
import { UserPhysicalProfileApiService } from '../data-access/user-physical-profile-api.service';
import { UserWeightRecordApiService } from '../data-access/user-weight-record-api.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';

@Component({
  selector: 'app-user-progress-page',
  standalone: true,
  imports: [
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule,
    BaseChartDirective,
    PageHeaderComponent
  ],
  templateUrl: './user-progress.page.html',
  styleUrl: './user-progress.page.scss'
})
export class UserProgressPageComponent {
  @ViewChild(BaseChartDirective) chartDirective?: BaseChartDirective;

  private readonly authService = inject(AuthService);
  private readonly profileApi = inject(UserPhysicalProfileApiService);
  private readonly weightApi = inject(UserWeightRecordApiService);
  private readonly toastr = inject(ToastrService);

  readonly userName = this.authService.snapshot?.user.fullName ?? 'Usuario';
  private readonly userId = this.authService.snapshot?.user.id ?? '';

  readonly weightRecords = signal<UserWeightRecord[]>([]);
  readonly physicalProfile = signal<UserPhysicalProfile | null>(null);

  readonly isLoading = signal(false);
  readonly isLoadingProfile = signal(false);
  readonly isLoadingWeights = signal(false);
  readonly isGeneratingPdf = signal(false);

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    datasets: [{
      data: [],
      label: 'Peso (kg)',
      fill: false,
      borderColor: '#1976d2',
      backgroundColor: '#1976d2',
      tension: 0.3,
      pointRadius: 5,
      pointHoverRadius: 7
    }],
    labels: []
  };
  public lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8, bottom: 8, left: 4, right: 8 } },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { title: { display: true, text: 'Fecha' }, ticks: { maxTicksLimit: 8, maxRotation: 30, autoSkip: true } },
      y: { title: { display: true, text: 'Peso (kg)' } }
    }
  };
  public lineChartType: 'line' = 'line';

  constructor() {
    Chart.register(...registerables);
    this.loadMyData();
  }

  get weightGoalProgress(): { current: number; progress: number; start: number; goal: number } | null {
    const profile = this.physicalProfile();
    const records = this.weightRecords();
    if (!profile?.pesoInicio || !profile?.pesoObjetivo || !records.length) return null;

    const sorted = [...records].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const latestPeso = sorted[0].peso;
    const { pesoInicio, pesoObjetivo } = profile;

    let progress: number;
    if (pesoObjetivo > pesoInicio) {
      progress = (latestPeso - pesoInicio) / (pesoObjetivo - pesoInicio);
    } else if (pesoObjetivo < pesoInicio) {
      progress = (pesoInicio - latestPeso) / (pesoInicio - pesoObjetivo);
    } else {
      progress = 1;
    }

    return { current: latestPeso, progress: Math.max(0, Math.min(1, progress)), start: pesoInicio, goal: pesoObjetivo };
  }

  updateChart(): void {
    const sorted = [...this.weightRecords()].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    this.lineChartData.labels = sorted.map((w) => new Date(w.fecha).toLocaleDateString());
    this.lineChartData.datasets[0].data = sorted.map((w) => w.peso);
    setTimeout(() => this.chartDirective?.chart?.resize());
  }

  async generatePdf(): Promise<void> {
    this.isGeneratingPdf.set(true);
    try {
      const chartInstance = this.chartDirective?.chart;
      const chartCanvas = chartInstance?.canvas;
      let imgData: string | null = null;

      if (chartCanvas) {
        const origDisplay = chartCanvas.style.display;
        chartCanvas.style.display = 'block';
        imgData = chartCanvas.toDataURL('image/png');
        chartCanvas.style.display = origDisplay;
      }

      let logo: HTMLImageElement | null = null;
      try { logo = await this.loadImage('assets/icons/gym_icon_192x192.png'); } catch { /* ignore */ }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      let yPos = 22;

      if (logo) {
        const logoSize = 10;
        pdf.addImage(logo, 'PNG', margin, yPos - 5, logoSize, logoSize);
        pdf.setFontSize(16);
        pdf.setFont('Helvetica', 'bold');
        pdf.text('TEAM BRUSTER', margin + logoSize + 4, yPos + 1);
        pdf.setFont('Helvetica', 'normal');
        yPos += 8;
        pdf.setFontSize(12);
        pdf.text(`Reporte de Progreso - ${this.userName}`, margin, yPos);
      } else {
        pdf.setFontSize(14);
        pdf.setFont('Helvetica', 'bold');
        pdf.text(`TEAM BRUSTER - ${this.userName}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 6;
      }
      yPos += 3;
      pdf.setFontSize(8);
      pdf.text(`Generado el: ${new Date().toLocaleDateString()}`, pageWidth - margin, yPos - 2, { align: 'right' });
      yPos += 5;
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.3);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      if (imgData) {
        const chartRatio = chartCanvas!.width / chartCanvas!.height;
        const maxChartWidth = (pageWidth - margin * 2) * 0.65;
        const maxChartHeight = 80;
        let chartW = chartRatio > maxChartWidth / maxChartHeight ? maxChartWidth : maxChartHeight * chartRatio;
        let chartH = chartRatio > maxChartWidth / maxChartHeight ? chartW / chartRatio : maxChartHeight;
        const chartX = (pageWidth - chartW) / 2;
        pdf.addImage(imgData, 'PNG', chartX, yPos, chartW, chartH);
        yPos += chartH + 12;
      }

      const profile = this.physicalProfile();
      if (profile) {
        if (yPos > pageHeight - 50) { pdf.addPage(); yPos = 32; }
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;
        pdf.setFontSize(12);
        pdf.setFont('Helvetica', 'bold');
        pdf.text('Perfil y Objetivos', margin, yPos);
        pdf.setFont('Helvetica', 'normal');
        yPos += 8;
        pdf.setFontSize(10);
        const rows: [string, string][] = [
          ['Fecha de inicio', this.toDateInputValue(profile.fechaInicio)],
          ['Peso inicial', `${profile.pesoInicio} kg`],
          ['Peso objetivo', `${profile.pesoObjetivo} kg`],
          ['Altura', `${profile.altura} m`],
          ['Peso ideal', `${profile.pesoIdeal} kg`],
          ['IMC', String(profile.imc ?? '-')],
        ];
        for (const [label, value] of rows) {
          pdf.setFont('Helvetica', 'bold');
          pdf.text(label, margin + 4, yPos);
          pdf.setFont('Helvetica', 'normal');
          const labelWidth = pdf.getTextWidth(`${label}:  `);
          pdf.text(value, margin + 4 + labelWidth, yPos);
          yPos += 6;
        }
        yPos += 4;
      }

      const records = this.weightRecords();
      if (records.length) {
        if (yPos > pageHeight - 50) { pdf.addPage(); yPos = 24; }
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;
        pdf.setFontSize(12);
        pdf.setFont('Helvetica', 'bold');
        pdf.text('Registros de Peso', margin, yPos);
        pdf.setFont('Helvetica', 'normal');
        yPos += 8;

        const sorted = [...records].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        const colFecha = margin + 4;
        const colPeso = 58;
        const colComentario = 96;
        const tableW = pageWidth - margin * 2;
        const rowH = 6;

        const drawHeader = () => {
          pdf.setFillColor(25, 118, 210);
          pdf.setTextColor(255, 255, 255);
          pdf.rect(colFecha - 4, yPos - rowH + 1, tableW - 8, rowH, 'F');
          pdf.setFontSize(9);
          pdf.setFont('Helvetica', 'bold');
          pdf.text('Fecha', colFecha, yPos - 1.5);
          pdf.text('Peso (kg)', colPeso, yPos - 1.5);
          pdf.text('Comentario', colComentario, yPos - 1.5);
          pdf.setFont('Helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          yPos += 1;
          pdf.setDrawColor(200, 205, 212);
          pdf.setLineWidth(0.3);
          pdf.line(colFecha - 4, yPos, colFecha - 4 + tableW - 8, yPos);
          yPos += 3;
        };
        drawHeader();

        for (let i = 0; i < sorted.length; i++) {
          if (yPos > pageHeight - 18) { pdf.addPage(); yPos = 24; drawHeader(); }
          const record = sorted[i];
          const bgColor: [number, number, number] = i % 2 === 0 ? [245, 247, 250] : [255, 255, 255];
          pdf.setFillColor(...bgColor);
          pdf.rect(colFecha - 4, yPos - rowH + 1.5, tableW - 8, rowH, 'F');
          pdf.setDrawColor(200, 205, 212);
          pdf.setLineWidth(0.15);
          pdf.line(colFecha - 4, yPos + 1, colFecha - 4 + tableW - 8, yPos + 1);
          pdf.setFontSize(9);
          pdf.text(new Date(record.fecha).toLocaleDateString(), colFecha, yPos - 0.5);
          pdf.text(String(record.peso), colPeso, yPos - 0.5);
          const comment = record.comentario || '';
          pdf.text(comment.length > 40 ? comment.substring(0, 40) + '...' : comment, colComentario, yPos - 0.5);
          yPos += 5.5;
        }
      }

      pdf.save(`reporte-${this.userName}-${new Date().toISOString().split('T')[0]}.pdf`);
      this.toastr.success('PDF generado correctamente.');
    } catch {
      this.toastr.error('No se pudo generar el PDF.');
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  private loadMyData(): void {
    this.isLoading.set(true);
    this.isLoadingProfile.set(true);
    this.isLoadingWeights.set(true);

    forkJoin({
      profile: this.profileApi.getByUserId(this.userId).pipe(finalize(() => this.isLoadingProfile.set(false))),
      weights: this.weightApi.getByUserId(this.userId).pipe(finalize(() => this.isLoadingWeights.set(false)))
    }).pipe(
      take(1),
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: ({ profile, weights }) => {
        this.physicalProfile.set(profile ?? null);
        this.weightRecords.set(weights);
        this.updateChart();
      },
      error: () => this.toastr.error('No se pudieron cargar tus datos.')
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private toDateInputValue(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const iso = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (iso) return iso;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().split('T')[0];
  }
}
