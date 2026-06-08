import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const notificationService = inject(NotificationService);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const isLoginRequest = request.url.includes('/api/auth/login');
      if (isLoginRequest && error.status === 401) {
        return throwError(() => error);
      }

      const message =
        error.error?.mensaje ??
        error.error?.message ??
        error.error?.title ??
        (error.status === 0 ? 'No se pudo conectar con la API del gimnasio.' : 'Se produjo un error inesperado.');

      notificationService.error(message);

      return throwError(() => error);
    })
  );
};