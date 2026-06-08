import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { UserRole } from '../models/auth.models';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredRoles = (route.data['roles'] as UserRole[] | undefined) ?? [];
  const sessionUser = authService.snapshot?.user;

  //console.log('Required roles for this route:', requiredRoles);
  //console.log('Current user roles:', sessionUser?.roles);
  if (!requiredRoles.length || authService.hasAnyRole(requiredRoles)) {
    return true;
  }

  // Si el usuario es Trainee y no tiene acceso a la ruta, redirige a /routines
  if (sessionUser?.roles?.includes('Trainee')) {
    return router.createUrlTree(['/routines']);
  }

  // Para otros roles, redirige a dashboard
  return router.createUrlTree(['/dashboard']);
};