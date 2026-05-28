import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionService } from '../services/session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(SessionService);
  const userId = sessionService.userId();

  if (!userId || req.url.startsWith('/assets')) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      'X-User-Id': String(userId)
    }
  });
  return next(authReq);
};