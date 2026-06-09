import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UsersApiService } from './features/users/data-access/users-api.service';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly swUpdate = inject(SwUpdate);

  private readonly usersApi = inject(UsersApiService);

  ngOnInit(): void {
    this.setupAppUpdateNotifier();

    this.authService.session$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((session) => {
        const user = session?.user;
        //console.log('Auth session changed:', session);
        if (user) {
          this.refreshUserState(user.id);
        }
      });
  }

  private setupAppUpdateNotifier(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(
        filter((event: VersionEvent) => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const toast = this.toastr.info(
          'Hay una nueva version disponible. Toca este mensaje para actualizar.',
          'Actualizacion disponible',
          {
            disableTimeOut: true,
            tapToDismiss: false,
            closeButton: true,
            positionClass: 'toast-top-right'
          }
        );

        toast.onTap
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => window.location.reload());
      });
  }

  private refreshUserState(userId: string) {
    this.usersApi.getById(userId).subscribe((usuario) => {
      if (usuario && (usuario.active === false || String(usuario.membershipStatus).toLowerCase() !== 'active')) {
          this.toastr.error('Tu sesión ha sido cerrada porque tu cuenta ya no está activa.', 'Acceso denegado', { positionClass: 'toast-top-right' });
          this.authService.logout();
        }
      //console.log('Refreshed user data:', usuario);
    })
  }
 
}
