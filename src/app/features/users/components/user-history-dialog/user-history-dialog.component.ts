import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType, Chart, registerables } from 'chart.js';
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
import { combineLatest, startWith, take } from 'rxjs';

import { UserPhysicalProfile, UserWeightRecord } from '../../../../core/models/gym.models';
import { UserPhysicalProfileApiService } from '../../data-access/user-physical-profile-api.service';
import { UserWeightRecordApiService } from '../../data-access/user-weight-record-api.service';
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
    BaseChartDirective
  ],
})
export class UserHistoryDialogComponent implements OnInit {
  @Input() userName: string = '';
  @Input() userId: string = '';

  private readonly profileApiService = inject(UserPhysicalProfileApiService);
  private readonly weightRecordApiService = inject(UserWeightRecordApiService);
  private readonly destroyRef = inject(DestroyRef);
  private currentProfileId: string | null = null;

  weightRecords: UserWeightRecord[] = [];

  form: FormGroup;
  goalsForm: FormGroup;

  // Configuración para ng2-charts
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
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: { title: { display: true, text: 'Fecha' } },
      y: { title: { display: true, text: 'Peso (kg)' } }
    }
  };
  public lineChartType: 'line' = 'line';

  constructor(private fb: FormBuilder) {
    // Registrar todas las escalas y elementos necesarios de Chart.js
    Chart.register(...registerables);
    this.form = this.fb.group({
      peso: ['', [Validators.required, Validators.min(0)]],
      comentario: ['']
    });
    this.goalsForm = this.fb.group({
      pesoInicio: ['', [Validators.required, Validators.min(0)]],
      pesoObjetivo: ['', [Validators.required, Validators.min(0)]],
      fechaInicio: ['', Validators.required],
      altura: ['', [Validators.required, Validators.min(0)]],
      pesoIdeal: ['', [Validators.required, Validators.min(0)]],
      imc: ['', [Validators.required, Validators.min(0)]],
      comentario: ['']
    });
    this.updateChart();
  }

  ngOnInit(): void {
    this.setupImcAutoCalculation();
    this.loadGoalsProfile();
    this.loadWeightRecords();
  }

  // Gráfico mock: calcula puntos SVG para la polilínea
  get weightGraphPoints() {
    if (!this.weightRecords.length) return [];
    const minPeso = Math.min(...this.weightRecords.map(w => w.peso));
    const maxPeso = Math.max(...this.weightRecords.map(w => w.peso));
    const range = maxPeso - minPeso || 1;
    const width = 300;
    const height = 80;
    return this.weightRecords.map((w, i) => {
      const x = 20 + (i * (width / (this.weightRecords.length - 1 || 1)));
      const y = 20 + height - ((w.peso - minPeso) / range) * height;
      return { x, y, label: this.toDate(w.fecha).toLocaleDateString() };
    });
  }

  get weightPolylinePoints() {
    return this.weightGraphPoints.map(p => `${p.x},${p.y}`).join(' ');
  }

  addWeightRecord() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const nuevo: Omit<UserWeightRecord, 'id'> = {
      userId: this.getProfileUserId(),
      fecha: new Date(),
      peso: Number(this.form.value.peso),
      comentario: this.form.value.comentario ? String(this.form.value.comentario) : ''
    };

    this.weightRecordApiService
      .create(nuevo)
      .pipe(take(1))
      .subscribe((created) => {
        this.weightRecords = [created, ...this.weightRecords];
        this.form.reset();
        this.updateChart();
      });
  }

  saveGoalsProfile() {
    if (this.goalsForm.invalid) {
      this.goalsForm.markAllAsTouched();
      return;
    }

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

    request$.pipe(take(1)).subscribe((saved) => {
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
      });
  }

  updateChart() {
    // Ordenar por fecha ascendente para el gráfico
    const sorted = [...this.weightRecords].sort((a, b) => this.toDate(a.fecha).getTime() - this.toDate(b.fecha).getTime());
    this.lineChartData.labels = sorted.map(w => this.toDate(w.fecha).toLocaleDateString());
    this.lineChartData.datasets[0].data = sorted.map(w => w.peso);
  }

  private loadGoalsProfile(): void {
    this.profileApiService
      .getByUserId(this.getProfileUserId())
      .pipe(take(1))
      .subscribe((profile) => {
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
      });
  }

  private loadWeightRecords(): void {
    this.weightRecordApiService
      .getByUserId(this.getProfileUserId())
      .pipe(take(1))
      .subscribe((records) => {
        this.weightRecords = records;
        this.updateChart();
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
    if (!raw) {
      return '';
    }

    const isoDateOnly = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (isoDateOnly) {
      return isoDateOnly;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

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
}
