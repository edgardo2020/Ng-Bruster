import { AsyncPipe, DatePipe } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject, signal, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map, shareReplay, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';

import { UserRole } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { LoadingService } from '../../core/services/loading.service';
import { ExpiredMembershipDialogComponent } from '../ui/expired-membership-dialog.component';
//import { ExpiredMembershipDialogComponent } from '../ui/expired-membership-dialog.component';

interface NavigationItem {
  label: string;
  icon: string;
  route: string;
  roles: UserRole[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSidenavModule,
    MatToolbarModule
  ],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.scss']
})
export class AppShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  readonly authService = inject(AuthService);
  readonly loadingService = inject(LoadingService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly navOpen = signal(true);

  readonly isDesktop$ = this.breakpointObserver.observe('(min-width: 960px)').pipe(
    map((result) => result.matches),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor() {
    this.isDesktop$.pipe(takeUntilDestroyed()).subscribe((isDesktop) => {
      this.navOpen.set(isDesktop);
    });

    this.authService.refreshCurrentUser().pipe(take(1)).subscribe(() => {
      this.checkMembershipExpiry();
    });
  }

  readonly navigation: NavigationItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', roles: ['Trainer'] },
    { label: 'Usuarios', icon: 'groups', route: '/users', roles: ['Trainer'] },
    { label: 'Membresías', icon: 'workspace_premium', route: '/memberships', roles: ['Trainer',] },
    { label: 'Ejercicios', icon: 'sports_gymnastics', route: '/exercises', roles: ['Trainer'] },
    { label: 'Comidas', icon: 'restaurant_menu', route: '/foods', roles: ['Trainer', 'Trainee'] },
    { label: 'Rutinas', icon: 'fitness_center', route: '/routines', roles: ['Trainer', 'Trainee'] },
    { label: 'Planes', icon: 'calendar_month', route: '/training-plans', roles: ['Trainer', 'Trainee'] },
    { label: 'Asignaciones', icon: 'assignment_ind', route: '/assignments', roles: ['Trainer'] },
    { label: 'Check-in', icon: 'qr_code_scanner', route: '/checkin', roles: ['Trainer', ] },
    { label: 'Reportes', icon: 'monitoring', route: '/reports', roles: ['Trainer'] }
  ];

  toggleSidebar(): void {
    this.navOpen.update((value) => !value);
  }

  closeOnMobile(isDesktop: boolean): void {
    if (!isDesktop) this.navOpen.set(false);
  }

  canAccess(roles: UserRole[]): boolean {
    return this.authService.hasAnyRole(roles);
  }

  goToProfile(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }

  /** Devuelve true solo si la fecha de expiración es estrictamente anterior a hoy (sin contar hoy). */
  isExpired(expiredTime: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiredTime);
    expiry.setHours(0, 0, 0, 0);
    return expiry < today;
  }

  private checkMembershipExpiry(): void {
    const user = this.authService.snapshot?.user;
    if (!user?.roles.includes('Trainee') || !user.expiredTime) return;
    if (!this.isExpired(user.expiredTime)) return;

    this.dialog.open(ExpiredMembershipDialogComponent, {
      disableClose: true,
      width: '400px',
      maxWidth: '92vw'
    }).afterClosed().pipe(take(1)).subscribe(() => {
      this.authService.logout();
    });
  }
}