import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

export const guestGuard: CanActivateFn = () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  if (sessionService.isGuest()) {
    return true;
  }

  if (sessionService.isAdmin()) {
    return router.createUrlTree(['/admin/dashboard']);
  }

  if (sessionService.isBarber()) {
    return router.createUrlTree(['/barber/dashboard']);
  }

  return router.createUrlTree(['/']);
};