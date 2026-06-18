import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, take } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly hidePassword = signal(true);
  readonly backendError = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    usuario: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.backendError()) {
        this.backendError.set(null);
      }
    });
  }

  get usuarioControl() {
    return this.form.controls.usuario;
  }

  get passwordControl() {
    return this.form.controls.password;
  }

  togglePassword(): void {
    this.hidePassword.update((value) => !value);
  }

  requestPasswordReset(): void {
    this.toastr.info('Contacta al administrador para restablecer tu contraseña o habilita el endpoint de recuperación en tu API.', 'Info', { positionClass: 'toast-top-right' });
  }

  requestSsoLogin(): void {
    this.toastr.info('Configura tu proveedor SSO en backend para habilitar este acceso.', 'Info', { positionClass: 'toast-top-right' });
  }

  requestFirstAccess(): void {
    this.toastr.info('Solicita al administrador la habilitacion de tu cuenta inicial.', 'Info', { positionClass: 'toast-top-right' });
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.backendError.set(null);

    const payload = this.form.getRawValue();

    this.authService
      .login(payload)
      .pipe(
        take(1),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: () => {
          const user = this.authService.snapshot?.user;
          if (user && (user.active === false || user.membershipStatus !== 'Active')) {
            this.toastr.error('Tu cuenta no está activa. Contacta al administrador.', 'Acceso denegado', { positionClass: 'toast-top-right' });
            this.authService.logout(false);
            return;
          }
          console.log('Usuario autenticado:', user?.membershipStatus);
          if (user?.roles.includes('Trainee')) {
            this.router.navigate(['/users/progress']);
          } else {
            this.router.navigate(['/dashboard']);
          }
          this.toastr.success('Bienvenido.', 'Éxito', { positionClass: 'toast-top-right' });
        },
        error: (error: HttpErrorResponse) => {
          this.backendError.set(
            error.status === 401
              ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
              : 'No fue posible iniciar sesión. Inténtalo nuevamente.'
          );
          this.form.controls.password.reset('');
        }
      });
  }
}