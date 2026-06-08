import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, delay, map, of, switchMap, tap, throwError, catchError, EMPTY } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthSession, CurrentUser, LoginApiResponse, LoginApiUser, LoginRequest, LoginResponse, ROL_MAP, UserRole } from '../models/auth.models';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'ngbeargym.session';
  private readonly sessionStorageKey = 'ngbeargym.session.temp';
  private readonly mockLoginEnabled = false;
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly notificationService = inject(NotificationService);

  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(this.restoreSession());

  readonly session$ = this.sessionSubject.asObservable();
  readonly currentUser$ = this.session$.pipe(map((session) => session?.user ?? null));
  readonly isAuthenticated$ = this.session$.pipe(map((session) => Boolean(session?.token)));

  get snapshot(): AuthSession | null {
    return this.sessionSubject.value;
  }

  login(payload: LoginRequest, options?: { rememberMe?: boolean }): Observable<AuthSession> {
    const rememberMe = options?.rememberMe ?? true;

    return this.http.post<LoginApiResponse>(`${environment.apiBaseUrl}/Auth/Login`, payload).pipe(
      switchMap((response) => {
        if (!response.exito) {
          this.notificationService.error(response.mensaje);
          return throwError(() => new Error(response.mensaje));
        }
        return of(this.toSessionFromApi(response.respuesta!));
      }),
      tap((session) => this.setSession(session, rememberMe))
    );
  }

  logout(redirect = true): void {
    this.sessionSubject.next(null);
    this.clearStorage();

    if (redirect) {
      this.router.navigate(['/auth/login']);
    }
  }

  getToken(): string | null {
    return this.sessionSubject.value?.token ?? null;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const userRoles = this.sessionSubject.value?.user.roles ?? [];
    return roles.some((role) => userRoles.includes(role));
  }

  refreshCurrentUser(): Observable<void> {
    const session = this.sessionSubject.value;
    if (!session?.user?.id) return EMPTY;

    return this.http
      .get<{ exito: boolean; respuesta: LoginApiUser | null }>(
        `${environment.apiBaseUrl}/Usuarios/ConsultaById?id=${session.user.id}`
      )
      .pipe(
        catchError(() => of(null)),
        map((res) => {
          if (!res?.exito || !res.respuesta) return;
          const dto = res.respuesta;
          const updatedUser: CurrentUser = {
            ...session.user,
            fullName: dto.nombre,
            email: dto.correo,
            membershipStatus: dto.membershipStatus as 'Active' | 'Inactive' | 'Pending' | undefined,
            expiredTime: dto.expiredTime,
            active: dto.visible
          };
          const updatedSession: AuthSession = { ...session, user: updatedUser };
          this.sessionSubject.next(updatedSession);
          this.persistSession(updatedSession, !!localStorage.getItem(this.storageKey));
        })
      );
  }

  private setSession(session: AuthSession, rememberMe = true): void {
    this.sessionSubject.next(session);
    this.persistSession(session, rememberMe);
  }

  private toSessionFromApi(apiUser: LoginApiUser): AuthSession {
    const user: CurrentUser = {
      id: String(apiUser.idUser),
      fullName: apiUser.nombre,
      email: apiUser.correo,
      idRol: apiUser.idRol,
      idEmpresa: apiUser.idEmpresa,
      roles: [ROL_MAP[apiUser.idRol] ?? 'Receptionist'],
      membershipStatus: apiUser.membershipStatus as 'Active' | 'Inactive' | 'Pending' | undefined,
      expiredTime: apiUser.expiredTime
    };

    return {
      token: apiUser.token,
      expiresAt: apiUser.expiredTime,
      user
    };
  }

  private toSession(response: LoginResponse): AuthSession {
    const tokenPayload = this.decodeToken(response.token);
    const resolvedRoles = this.resolveRoles(response.user?.roles, tokenPayload);

    const user: CurrentUser = {
      id: response.user?.id ?? this.getClaimString(tokenPayload, 'sub') ?? crypto.randomUUID(),
      fullName: response.user?.fullName ?? this.getClaimString(tokenPayload, 'name') ?? 'Gym Operator',
      email: response.user?.email ?? this.getClaimString(tokenPayload, 'email') ?? '',
      gymName: response.user?.gymName,
      avatarUrl: response.user?.avatarUrl,
      roles: resolvedRoles
    };

    return {
      token: response.token,
      expiresAt: response.expiresAt,
      user
    };
  }

  private resolveRoles(rawRoles: CurrentUser['roles'] | undefined, tokenPayload?: Record<string, unknown>): UserRole[] {
    const tokenRoles = [
      tokenPayload?.['role'],
      tokenPayload?.['roles'],
      tokenPayload?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
    ]
      .flat()
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => this.normalizeRole(entry))
      .filter((entry): entry is UserRole => Boolean(entry));

    const responseRoles = (rawRoles ?? [])
      .map((role) => this.normalizeRole(role))
      .filter((role): role is UserRole => Boolean(role));

    return responseRoles.length ? responseRoles : tokenRoles.length ? tokenRoles : ['Receptionist'];
  }

  private normalizeRole(value: string): UserRole | null {
    const normalized = value.toLowerCase();

    if (normalized.includes('admin')) {
      return 'Trainer';
    }

    if (normalized.includes('Trainee')) {
      return 'Trainee';
    }

    if (normalized.includes('reception')) {
      return 'Receptionist';
    }

    return null;
  }

  private restoreSession(): AuthSession | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const persistentSession = localStorage.getItem(this.storageKey);
    if (persistentSession) {
      return JSON.parse(persistentSession) as AuthSession;
    }

    const temporarySession = sessionStorage.getItem(this.sessionStorageKey);
    return temporarySession ? (JSON.parse(temporarySession) as AuthSession) : null;
  }

  private persistSession(session: AuthSession, rememberMe: boolean): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const serializedSession = JSON.stringify(session);

    if (rememberMe) {
      localStorage.setItem(this.storageKey, serializedSession);
      sessionStorage.removeItem(this.sessionStorageKey);
      return;
    }

    sessionStorage.setItem(this.sessionStorageKey, serializedSession);
    localStorage.removeItem(this.storageKey);
  }

  private clearStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.sessionStorageKey);
  }

  private decodeToken(token: string): Record<string, unknown> | undefined {
    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(normalized));
    } catch {
      return undefined;
    }
  }

  private getClaimString(payload: Record<string, unknown> | undefined, claim: string): string | undefined {
    const value = payload?.[claim];
    return typeof value === 'string' ? value : undefined;
  }
}