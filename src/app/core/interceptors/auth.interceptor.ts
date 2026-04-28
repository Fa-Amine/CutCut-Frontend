import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionService } from '../services/session.service';

/*export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(SessionService);
  const token = sessionService.token();

  // Skip adding token if none exists
  if (!token) {
    return next(req);
  }

  // Optional: skip auth header for external/public assets
  if (
    req.url.startsWith('/assets') ||
    req.url.startsWith('assets/')
  ) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authReq);
};*/