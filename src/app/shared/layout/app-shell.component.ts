import { AsyncPipe, DatePipe } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map, shareReplay, take } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
import { ThemeService } from '../../core/services/theme.service';
import { ExpiredMembershipDialogComponent } from '../ui/expired-membership-dialog.component';

interface NavigationItem {
  label: string;
  icon: string;
  route: string;
  roles: UserRole[];
  badge?: number | string;
  badgeType?: 'default' | 'accent';
}

interface NavSection {
  key: string;
  label: string;
  items: NavigationItem[];
}

interface TrainerStats {
  activeClients: number;
  sessionsToday: number;
  pendingPlans: number;
}

/**
 * Hoisted so every change-detection pass feeds RouterLinkActive the very same
 * object reference. A literal in the template creates a new instance each pass
 * and trips ExpressionChangedAfterItHasBeenChecked in dev mode.
 */
const EXACT_MATCH_OPTIONS: { exact: true } = { exact: true };

/* Kept deliberately light: the initials are drawn in near-black (#0a0a0a) on
   top, so every stop has to stay bright enough for that to stay readable. */
const AVATAR_GRADIENTS: readonly string[] = [
  'linear-gradient(135deg, #FFD400, #FFE44D)',
  'linear-gradient(135deg, #FFB300, #FFD400)',
  'linear-gradient(135deg, #FFC933, #FFEB99)',
  'linear-gradient(135deg, #FFD666, #FFF0A6)',
  'linear-gradient(135deg, #FF9E1B, #FFC93C)',
  'linear-gradient(135deg, #FFE066, #FFF3B0)',
];

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
    MatChipsModule,
    MatDialogModule,
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
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly navOpen = signal(true);
  readonly collapsed = signal(false);

  /**
   * A signal instead of an async pipe + @let: it is read synchronously, never
   * resolves twice, and cannot flip between the two dev-mode passes.
   */
  readonly isDesktop = toSignal(
    this.breakpointObserver.observe('(min-width: 960px)').pipe(map((result) => result.matches)),
    { initialValue: false }
  );

  readonly isTrainer = computed(() => this.authService.hasAnyRole(['Trainer']));

  readonly routerLinkActiveOptions = EXACT_MATCH_OPTIONS;

  readonly navigationSections = computed<NavSection[]>(() => {
    const isTrainer = this.isTrainer();
    const isTrainee = this.authService.hasAnyRole(['Trainee']);

    const sections: NavSection[] = [];

    if (isTrainee) {
      sections.push({
        key: 'training',
        label: 'Mi Entrenamiento',
        items: [
          { label: 'Progreso', icon: 'monitoring', route: '/users/progress', roles: ['Trainee'] },
          { label: 'Mis Rutinas', icon: 'fitness_center', route: '/routines', roles: ['Trainee'] },
          { label: 'Mis Planes', icon: 'calendar_month', route: '/training-plans', roles: ['Trainee'] },
          { label: 'Comidas', icon: 'restaurant_menu', route: '/foods', roles: ['Trainee'] },
        ]
      });
    }

    if (isTrainer) {
      sections.push({
        key: 'clients',
        label: 'Clientes',
        items: [
          { label: 'Usuarios', icon: 'groups', route: '/users', roles: ['Trainer'] },
          { label: 'Asignaciones', icon: 'assignment_ind', route: '/assignments', roles: ['Trainer'] },
        ]
      });

      sections.push({
        key: 'programming',
        label: 'Programación',
        items: [
          { label: 'Ejercicios', icon: 'sports_gymnastics', route: '/exercises', roles: ['Trainer'] },
          { label: 'Rutinas', icon: 'fitness_center', route: '/routines', roles: ['Trainer'] },
          { label: 'Planes', icon: 'calendar_month', route: '/training-plans', roles: ['Trainer'] },
        ]
      });

      sections.push({
        key: 'nutrition',
        label: 'Nutrición',
        items: [
          { label: 'Comidas', icon: 'restaurant_menu', route: '/foods', roles: ['Trainer'] },
        ]
      });
    }

    return sections.filter(s => s.items.some(item => this.authService.hasAnyRole(item.roles)));
  });

  readonly trainerStats$ = this.authService.currentUser$.pipe(
    map(user => {
      if (!user || !user.roles.includes('Trainer')) return null;
      return {
        activeClients: 24,
        sessionsToday: 8,
        pendingPlans: 3
      } as TrainerStats;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor() {
    // `effect` defers the writes out of the current change-detection pass, so
    // `navOpen` never changes between the check and the no-change re-check.
    effect(() => {
      this.navOpen.set(this.isDesktop());
    });

    this.authService.refreshCurrentUser().pipe(take(1)).subscribe(() => {
      this.checkMembershipExpiry();
    });
  }

  toggleSidebar(): void {
    if (this.isDesktop()) {
      this.collapsed.update((v) => !v);
    } else {
      this.navOpen.update((v) => !v);
    }
  }

  closeOnMobile(isDesktop: boolean): void {
    if (!isDesktop) this.navOpen.set(false);
  }

  navigate(route: string): void {
    this.router.navigate([route]);
    if (!this.isDesktop()) this.navOpen.set(false);
  }

  isActiveRoute(route: string): boolean {
    return this.router.isActive(route, { paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' });
  }

  getAvatarGradient(name: string): string {
    const gradients = AVATAR_GRADIENTS;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  }

  logout(): void {
    this.authService.logout();
  }

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