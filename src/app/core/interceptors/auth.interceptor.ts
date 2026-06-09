import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionService } from '../services/session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(SessionService);
  const userId = sessionService.userId();

  // ✅ Ne pas ajouter le header sur Cloudinary et autres API externes
  if (!userId
    || req.url.startsWith('/assets')
    || req.url.includes('cloudinary.com')
    || req.url.includes('nominatim.openstreetmap.org')
    || req.url.includes('unpkg.com')
  ) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      'X-User-Id': String(userId)
    }
  });

  return next(authReq);
};