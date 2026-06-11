import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

export const adminGuard: CanActivateFn = () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  if (sessionService.isAdmin()) {
    return true;
  }

  if (sessionService.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  return router.createUrlTree(['/login']);
};