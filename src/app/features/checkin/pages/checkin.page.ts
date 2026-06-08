import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { NotificationService } from '../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { CheckinStore } from '../data-access/checkin.store';

@Component({
  selector: 'app-checkin-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, PageHeaderComponent],
  template: `
    <section class="app-page">
      <app-page-header
        title="Check-in"
        subtitle="Registro manual listo para evolucionar a escaneo QR y validaciones del backend."
        meta="Recepción digital"
      />

      <section class="section-grid">
        <article class="card-surface">
          <div class="panel-header">
            <div>
              <h2>Registrar entrada</h2>
              <p>Formulario operativo para recepción o kiosco asistido.</p>
            </div>
          </div>

          <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Cliente</mat-label>
              <input matInput formControlName="userName" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Membresía</mat-label>
              <input matInput formControlName="membershipName" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Canal</mat-label>
              <mat-select formControlName="channel">
                <mat-option value="Manual">Manual</mat-option>
                <mat-option value="QR">QR</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="full-span">
              <button mat-flat-button color="primary" type="submit">Registrar check-in</button>
            </div>
          </form>
        </article>

        <article class="card-surface">
          <div class="panel-header">
            <div>
              <h2>Actividad reciente</h2>
              <p>Visibilidad inmediata para recepción y operación.</p>
            </div>
          </div>

          @if (store.vm$ | async; as vm) {
            @if (vm.data.length) {
              <div class="summary-strip">
                @for (checkin of vm.data; track checkin.id) {
                  <article>
                    <strong>{{ checkin.userName }}</strong>
                    <p>{{ checkin.membershipName }}</p>
                    <small>{{ checkin.channel }} · {{ checkin.checkInAt | date:'short' }}</small>
                  </article>
                }
              </div>
            } @else {
              <div class="empty-state">Todavía no hay ingresos registrados.</div>
            }
          }
        </article>
      </section>
    </section>
  `
})
export class CheckinPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);

  readonly store = inject(CheckinStore);

  readonly form = this.formBuilder.nonNullable.group({
    userName: ['', Validators.required],
    membershipName: ['', Validators.required],
    channel: ['Manual' as 'Manual' | 'QR', Validators.required]
  });

  ngOnInit(): void {
    this.store.load();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.store
      .create({
        ...this.form.getRawValue(),
        checkInAt: new Date().toISOString()
      })
      .pipe(take(1))
      .subscribe(() => {
        this.notificationService.success('Check-in registrado.');
        this.form.reset({ userName: '', membershipName: '', channel: 'Manual' });
      });
  }
}