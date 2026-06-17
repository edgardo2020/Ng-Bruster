import { Component, DestroyRef, Input, OnInit, AfterViewInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import jsPDF from 'jspdf';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, Chart, registerables } from 'chart.js';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest, finalize, startWith, take } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { UserPhysicalProfile, UserWeightRecord } from '../../../../core/models/gym.models';
import { UserPhysicalProfileApiService } from '../../data-access/user-physical-profile-api.service';
import { UserWeightRecordApiService } from '../../data-access/user-weight-record-api.service';
import { AskDialogComponent } from '../../../../shared/ui/ask-dialog.component';

export interface UserHistoryRecord {
  date: string;
  type: string;
  description: string;
  notes?: string;
}

export interface UserHistoryDialogData {
  userName: string;
  history: UserHistoryRecord[];
}

@Component({
  selector: 'app-user-history-dialog',
  templateUrl: './user-history-dialog.component.html',
  styleUrls: ['./user-history-dialog.component.scss'],
   standalone: true,
  imports: [
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    ReactiveFormsModule,
    DatePipe,
    CommonModule,
    MatTableModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    BaseChartDirective
  ],
})
export class UserHistoryDialogComponent implements OnInit, AfterViewInit {
  @Input() userName: string = '';
  @Input() userId: string = '';
  @ViewChild(BaseChartDirective) chartDirective?: BaseChartDirective;

  private readonly profileApiService = inject(UserPhysicalProfileApiService);
  private readonly weightRecordApiService = inject(UserWeightRecordApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toastr = inject(ToastrService);
  private readonly dialog = inject(MatDialog);
  private currentProfileId: string | null = null;

  weightRecords: UserWeightRecord[] = [];

  readonly isLoading = signal(false);
  readonly isSavingGoal = signal(false);
  readonly isSavingWeight = signal(false);
  readonly isDeletingWeight = signal(false);
  readonly isGeneratingPdf = signal(false);

  form: FormGroup;
  goalsForm: FormGroup;

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    datasets: [
      {
        data: [],
        label: 'Peso (kg)',
        fill: false,
        borderColor: '#1976d2',
        backgroundColor: '#1976d2',
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ],
    labels: []
  };
  public lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 8, bottom: 8, left: 4, right: 8 }
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: {
        title: { display: true, text: 'Fecha' },
        ticks: {
          maxTicksLimit: 8,
          maxRotation: 30,
          autoSkip: true
        }
      },
      y: {
        title: { display: true, text: 'Peso (kg)' }
      }
    }
  };
  public lineChartType: 'line' = 'line';

  constructor(private fb: FormBuilder) {
    Chart.register(...registerables);
    this.form = this.fb.group({
      peso: ['', [Validators.required, Validators.min(0.1)]],
      comentario: ['']
    });
    this.goalsForm = this.fb.group({
      pesoInicio: ['', [Validators.required, Validators.min(0.1)]],
      pesoObjetivo: ['', [Validators.required, Validators.min(0.1)]],
      fechaInicio: ['', Validators.required],
      altura: ['', [Validators.required, Validators.min(0.01)]],
      pesoIdeal: ['', [Validators.required, Validators.min(0.1)]],
      imc: [{ value: '', disabled: true }, [Validators.required, Validators.min(0)]],
      comentario: ['']
    });
    this.updateChart();
  }

  ngOnInit(): void {
    this.setupImcAutoCalculation();
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.setupChartResizeObserver();
  }

  get weightGoalProgress(): { current: number; progress: number; start: number; goal: number } | null {
    const pesoInicio = Number(this.goalsForm.value.pesoInicio);
    const pesoObjetivo = Number(this.goalsForm.value.pesoObjetivo);
    if (!pesoInicio || !pesoObjetivo || !this.weightRecords.length) return null;

    const sorted = [...this.weightRecords].sort(
      (a, b) => this.toDate(b.fecha).getTime() - this.toDate(a.fecha).getTime()
    );
    const latestPeso = sorted[0].peso;

    let progress: number;
    if (pesoObjetivo > pesoInicio) {
      progress = (latestPeso - pesoInicio) / (pesoObjetivo - pesoInicio);
    } else if (pesoObjetivo < pesoInicio) {
      progress = (pesoInicio - latestPeso) / (pesoInicio - pesoObjetivo);
    } else {
      progress = 1;
    }

    return {
      current: latestPeso,
      progress: Math.max(0, Math.min(1, progress)),
      start: pesoInicio,
      goal: pesoObjetivo
    };
  }

  addWeightRecord(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSavingWeight.set(true);
    const nuevo: Omit<UserWeightRecord, 'id'> = {
      userId: this.getProfileUserId(),
      fecha: new Date(),
      peso: Number(this.form.value.peso),
      comentario: this.form.value.comentario ? String(this.form.value.comentario) : ''
    };

    this.weightRecordApiService
      .create(nuevo)
      .pipe(
        take(1),
        finalize(() => this.isSavingWeight.set(false))
      )
      .subscribe({
        next: (created) => {
          this.weightRecords = [created, ...this.weightRecords];
          this.form.reset();
          this.form.markAsPristine();
          this.updateChart();
          this.toastr.success('Registro de peso agregado.');
        },
        error: (err) => this.toastr.error(this.getErrorMessage(err, 'No se pudo agregar el registro.'))
      });
  }

  deleteWeightRecord(id: string | undefined): void {
    if (!id) return;

    const dialogRef = this.dialog.open(AskDialogComponent, {
      data: { message: '¿Eliminar este registro de peso?', title: 'Confirmar eliminación' }
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe((result) => {
      if (!result) return;

      this.isDeletingWeight.set(true);
      this.weightRecordApiService
        .remove(id)
        .pipe(
          take(1),
          finalize(() => this.isDeletingWeight.set(false))
        )
        .subscribe({
          next: () => {
            this.weightRecords = this.weightRecords.filter((w) => w.id !== id);
            this.updateChart();
            this.toastr.success('Registro de peso eliminado.');
          },
          error: (err) => this.toastr.error(this.getErrorMessage(err, 'No se pudo eliminar el registro.'))
        });
    });
  }

  saveGoalsProfile(): void {
    if (this.goalsForm.invalid) {
      this.goalsForm.markAllAsTouched();
      return;
    }

    this.isSavingGoal.set(true);
    const raw = this.goalsForm.getRawValue();
    const imcCalculado = this.calculateImc(raw.pesoInicio, raw.altura);
    const payload: Omit<UserPhysicalProfile, 'userId'> = {
      pesoInicio: Number(raw.pesoInicio),
      pesoObjetivo: Number(raw.pesoObjetivo),
      fechaInicio: this.toApiDateTime(raw.fechaInicio),
      altura: Number(raw.altura),
      pesoIdeal: Number(raw.pesoIdeal),
      imc: imcCalculado ?? Number(raw.imc),
      comentario: raw.comentario ? String(raw.comentario) : ''
    };

    const request$ = this.currentProfileId
      ? this.profileApiService.update({ id: this.currentProfileId, userId: this.getProfileUserId(), ...payload })
      : this.profileApiService.create({ userId: this.getProfileUserId(), ...payload });

    request$
      .pipe(
        take(1),
        finalize(() => this.isSavingGoal.set(false))
      )
      .subscribe({
        next: (saved) => {
          this.goalsForm.patchValue({
            pesoInicio: saved.pesoInicio,
            pesoObjetivo: saved.pesoObjetivo,
            fechaInicio: this.toDateInputValue(saved.fechaInicio),
            altura: saved.altura,
            pesoIdeal: saved.pesoIdeal,
            imc: saved.imc,
            comentario: saved.comentario ?? ''
          });
          this.currentProfileId = saved.id ?? this.currentProfileId;
          this.goalsForm.markAsPristine();
          this.toastr.success('Perfil guardado correctamente.');
        },
        error: (err) => this.toastr.error(this.getErrorMessage(err, 'No se pudo guardar el perfil.'))
      });
  }

  updateChart(): void {
    const sorted = [...this.weightRecords].sort(
      (a, b) => this.toDate(a.fecha).getTime() - this.toDate(b.fecha).getTime()
    );

    const isMobile = window.innerWidth <= 720;
    const labels = sorted.map((w) => this.toDate(w.fecha).toLocaleDateString());
    const values = sorted.map((w) => w.peso);
    const dataset = this.lineChartData.datasets[0];

    if (isMobile && sorted.length >= 2) {
      const firstDate = this.toDate(sorted[0].fecha);
      const lastDate = this.toDate(sorted[sorted.length - 1].fecha);
      const padStart = new Date(firstDate);
      padStart.setDate(padStart.getDate() - 10);
      const padEnd = new Date(lastDate);
      padEnd.setDate(padEnd.getDate() + 10);

      this.lineChartData.labels = [padStart.toLocaleDateString(), ...labels, padEnd.toLocaleDateString()];
      dataset.data = [null, ...values, null];
      dataset.spanGaps = true;
    } else {
      this.lineChartData.labels = labels;
      dataset.data = values;
      dataset.spanGaps = false;
    }

    setTimeout(() => this.chartDirective?.chart?.resize());
  }

  trackByWeightRecord(index: number, record: UserWeightRecord): string | number {
    return record.id ?? index;
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
      try {
        logo = await this.loadImage('assets/icons/gym_icon_192x192.png');
      } catch {
        /* continue without logo */
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      let yPos = 22;

      const SYSTEM_NAME = 'TEAM BRUSTER';

      const drawPageHeader = () => {
        if (logo) {
          const logoSize = 10;
          pdf.addImage(logo, 'PNG', margin, yPos - 5, logoSize, logoSize);
          pdf.setFontSize(16);
          pdf.setFont('Helvetica', 'bold');
          pdf.text(SYSTEM_NAME, margin + logoSize + 4, yPos + 1);
          pdf.setFont('Helvetica', 'normal');
          yPos += 8;
          pdf.setFontSize(12);
          pdf.text(`Reporte de Progreso - ${this.userName}`, margin, yPos);
        } else {
          pdf.setFontSize(14);
          pdf.setFont('Helvetica', 'bold');
          pdf.text(`${SYSTEM_NAME} - ${this.userName}`, pageWidth / 2, yPos, { align: 'center' });
          pdf.setFont('Helvetica', 'normal');
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
      };
      drawPageHeader();

      if (imgData) {
        const chartRatio = chartCanvas!.width / chartCanvas!.height;
        const maxChartWidth = (pageWidth - margin * 2) * 0.65;
        const maxChartHeight = 80;
        let chartW: number;
        let chartH: number;
        if (chartRatio > maxChartWidth / maxChartHeight) {
          chartW = maxChartWidth;
          chartH = chartW / chartRatio;
        } else {
          chartH = maxChartHeight;
          chartW = chartH * chartRatio;
        }
        const chartX = (pageWidth - chartW) / 2;
        pdf.addImage(imgData, 'PNG', chartX, yPos, chartW, chartH);
        yPos += chartH + 12;
      }

      const raw = this.goalsForm.getRawValue();
      const pesoInicio = raw.pesoInicio;
      const pesoObjetivo = raw.pesoObjetivo;
      const altura = raw.altura;
      const imc = raw.imc;
      const pesoIdeal = raw.pesoIdeal;
      const fechaInicio = raw.fechaInicio;

      if (pesoInicio || pesoObjetivo) {
        if (yPos > pageHeight - 50) { pdf.addPage(); yPos = 20; drawPageHeader(); yPos = 32; }
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
        const goalsRows: [string, string][] = [
          ['Fecha de inicio', fechaInicio ? this.toDateInputValue(fechaInicio) : '-'],
          ['Peso inicial', `${pesoInicio ?? '-'} kg`],
          ['Peso objetivo', `${pesoObjetivo ?? '-'} kg`],
          ['Altura', `${altura ?? '-'} m`],
          ['Peso ideal', `${pesoIdeal ?? '-'} kg`],
          ['IMC', String(imc ?? '-')],
        ];

        for (const [label, value] of goalsRows) {
          pdf.setFont('Helvetica', 'bold');
          pdf.text(label, margin + 4, yPos);
          pdf.setFont('Helvetica', 'normal');
          const labelWidth = pdf.getTextWidth(`${label}:  `);
          pdf.text(value, margin + 4 + labelWidth, yPos);
          yPos += 6;
        }
        yPos += 4;
      }

      if (this.weightRecords.length) {
        if (yPos > pageHeight - 50) { pdf.addPage(); yPos = 20; }
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;
        pdf.setFontSize(12);
        pdf.setFont('Helvetica', 'bold');
        pdf.text('Registros de Peso', margin, yPos);
        pdf.setFont('Helvetica', 'normal');
        yPos += 8;

        const sorted = [...this.weightRecords].sort(
          (a, b) => this.toDate(b.fecha).getTime() - this.toDate(a.fecha).getTime()
        );

        const colFecha = margin + 4;
        const colPeso = 58;
        const colComentario = 96;
        const tableW = pageWidth - margin * 2;
        const rowH = 6;

        const headerBg = [25, 118, 210];
        const headerTextColor = [255, 255, 255];
        const rowEvenBg = [245, 247, 250];
        const rowOddBg = [255, 255, 255];
        const borderColor = [200, 205, 212];

        const drawTableHeader = () => {
          pdf.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
          pdf.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
          pdf.rect(colFecha - 4, yPos - rowH + 1, tableW - 8, rowH, 'F');
          pdf.setFontSize(9);
          pdf.setFont('Helvetica', 'bold');
          pdf.text('Fecha', colFecha, yPos - 1.5);
          pdf.text('Peso (kg)', colPeso, yPos - 1.5);
          pdf.text('Comentario', colComentario, yPos - 1.5);
          pdf.setFont('Helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          yPos += 1;
          pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
          pdf.setLineWidth(0.3);
          pdf.line(colFecha - 4, yPos, colFecha - 4 + tableW - 8, yPos);
          yPos += 3;
        };
        drawTableHeader();

        for (let i = 0; i < sorted.length; i++) {
          if (yPos > pageHeight - 18) {
            pdf.addPage(); yPos = 24;
            drawTableHeader();
          }
          const record = sorted[i];
          const isEven = i % 2 === 0;
          const rowBg = isEven ? rowEvenBg : rowOddBg;
          pdf.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
          pdf.rect(colFecha - 4, yPos - rowH + 1.5, tableW - 8, rowH, 'F');

          pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
          pdf.setLineWidth(0.15);
          pdf.line(colFecha - 4, yPos + 1, colFecha - 4 + tableW - 8, yPos + 1);

          pdf.setFontSize(9);
          pdf.text(this.toDate(record.fecha).toLocaleDateString(), colFecha, yPos - 0.5);
          pdf.text(String(record.peso), colPeso, yPos - 0.5);
          const comment = record.comentario || '';
          pdf.text(comment.length > 40 ? comment.substring(0, 40) + '...' : comment, colComentario, yPos - 0.5);
          yPos += 5.5;
        }
        pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        pdf.setLineWidth(0.3);
        pdf.line(colFecha - 4, yPos - 0.5, colFecha - 4 + tableW - 8, yPos - 0.5);
      }

      pdf.save(`reporte-${this.userName}-${new Date().toISOString().split('T')[0]}.pdf`);
      this.toastr.success('PDF generado correctamente.');
    } catch (err) {
      this.toastr.error(this.getErrorMessage(err, 'No se pudo generar el PDF.'));
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  private setupChartResizeObserver(): void {
    const canvasEl = this.chartDirective?.chart?.canvas;
    if (!canvasEl) return;
    const container = canvasEl.parentElement;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      this.chartDirective?.chart?.resize();
    });
    observer.observe(container);
    this.destroyRef.onDestroy(() => observer.disconnect());

    this.chartDirective?.chart?.resize();
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.loadGoalsProfile();
    this.loadWeightRecords();
  }

  private loadGoalsProfile(): void {
    this.profileApiService
      .getByUserId(this.getProfileUserId())
      .pipe(
        take(1),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (profile) => {
          if (!profile) {
            this.currentProfileId = null;
            return;
          }
          this.currentProfileId = profile.id ?? null;
          this.goalsForm.patchValue({
            pesoInicio: profile.pesoInicio,
            pesoObjetivo: profile.pesoObjetivo,
            fechaInicio: this.toDateInputValue(profile.fechaInicio),
            altura: profile.altura,
            pesoIdeal: profile.pesoIdeal,
            imc: profile.imc,
            comentario: profile.comentario ?? ''
          });
        },
        error: (err) => this.toastr.error(this.getErrorMessage(err, 'No se pudo cargar el perfil.'))
      });
  }

  private loadWeightRecords(): void {
    this.weightRecordApiService
      .getByUserId(this.getProfileUserId())
      .pipe(
        take(1),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (records) => {
          this.weightRecords = records;
          this.updateChart();
        },
        error: (err) => this.toastr.error(this.getErrorMessage(err, 'No se pudieron cargar los registros de peso.'))
      });
  }

  private getProfileUserId(): string {
    return (this.userId || '').trim() || (this.userName || '').trim() || 'default';
  }

  private setupImcAutoCalculation(): void {
    const pesoInicioControl = this.goalsForm.controls['pesoInicio'];
    const alturaControl = this.goalsForm.controls['altura'];

    combineLatest([
      pesoInicioControl.valueChanges.pipe(startWith(pesoInicioControl.value)),
      alturaControl.valueChanges.pipe(startWith(alturaControl.value))
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([pesoInicio, altura]) => {
        const imc = this.calculateImc(pesoInicio, altura);
        this.goalsForm.controls['imc'].setValue(imc ?? '', { emitEvent: false });
      });
  }

  private calculateImc(pesoInicio: unknown, altura: unknown): number | null {
    const peso = Number(pesoInicio);
    const alturaMetros = Number(altura);
    if (!Number.isFinite(peso) || !Number.isFinite(alturaMetros) || peso <= 0 || alturaMetros <= 0) {
      return null;
    }
    const imc = peso / (alturaMetros * alturaMetros);
    return Number(imc.toFixed(2));
  }

  private toDateInputValue(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const isoDateOnly = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (isoDateOnly) return isoDateOnly;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toApiDateTime(value: unknown): string {
    const dateOnly = this.toDateInputValue(value);
    return dateOnly ? `${dateOnly}T00:00:00` : '';
  }

  private toDate(value: string | Date): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private getErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallbackMessage;
  }
}
