import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { Membership, MembershipStatus } from '../../../core/models/gym.models';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { AskDialogComponent } from '../../../shared/ui/ask-dialog.component';
import { MembershipsStore } from '../data-access/memberships.store';

@Component({
  selector: 'app-memberships-page',
  standalone: true,
  imports: [
    AsyncPipe,
    CurrencyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    PageHeaderComponent,
    AskDialogComponent
  ],
  templateUrl: './memberships.page.html',
  styleUrl: './memberships.page.scss'
})
export class MembershipsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);

  readonly store = inject(MembershipsStore);
  readonly editingId = signal<string | null>(null);
  readonly displayedColumns = ['name', 'price', 'durationInDays', 'status', 'actions'];
  readonly statuses: MembershipStatus[] = ['Active', 'Expired', 'Cancelled'];

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    price: [49, [Validators.required, Validators.min(1)]],
    durationInDays: [30, [Validators.required, Validators.min(1)]],
    status: ['Active' as MembershipStatus, Validators.required],
    benefitsText: ['Acceso general']
  });

  ngOnInit(): void {
    this.store.load();
  }

  edit(membership: Membership): void {
    this.editingId.set(membership.id);
    this.form.patchValue({
      ...membership,
      benefitsText: membership.benefits.join('\n')
    });
  }

  remove(membership: Membership): void {
    inject(MatDialog)
      .open(AskDialogComponent, {
        data: {
          message: `¿Eliminar la membresía ${membership.name}?`,
          title: 'Confirmar eliminación'
        }
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((result: boolean) => {
        if (!result) return;
        this.store
          .remove(membership.id)
          .pipe(take(1))
          .subscribe({
            next: () => this.notificationService.success('Membresía eliminada.'),
            error: (error: unknown) => this.notificationService.error('No se pudo eliminar la membresía.' + (error ? ' ' + String(error) : ''))
          });
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const payload: Membership = {
      id: this.editingId() ?? crypto.randomUUID(),
      name: rawValue.name,
      price: rawValue.price,
      durationInDays: rawValue.durationInDays,
      status: rawValue.status,
      benefits: rawValue.benefitsText.split('\n').map((item) => item.trim()).filter(Boolean)
    };

    const request$ = this.editingId() ? this.store.update(payload) : this.store.create(payload);
    request$.pipe(take(1)).subscribe(() => {
      this.notificationService.success(this.editingId() ? 'Membresía actualizada.' : 'Membresía creada.');
      this.resetForm();
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      price: 49,
      durationInDays: 30,
      status: 'Active',
      benefitsText: 'Acceso general'
    });
  }

  statusClass(status: MembershipStatus): string {
    return `status-chip--${status.toLowerCase()}`;
  }
}