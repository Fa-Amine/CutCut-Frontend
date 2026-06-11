import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'map',
    pathMatch: 'full'
  },
  {
    path: 'map',
    loadComponent: () =>
      import('./features/map/map.page').then(m => m.MapPage)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.page').then(m => m.RegisterPage)
  },
  {
    path: 'barbers',
    loadComponent: () =>
      import('./features/barbers/barbers-list/barbers-list.page').then(
        m => m.BarbersListPage
      )
  },
  {
    path: 'barbers/:id',
    loadComponent: () =>
      import('./features/barber/barber-details/barber-details.page').then(
        m => m.BarberDetailsPage
      )
  },
  {
    path: 'booking/:barberId',
    loadComponent: () =>
      import('./features/bookings/booking-create/booking-create.page').then(
        m => m.BookingCreatePage
      )
  },
  {
    path: 'my-bookings',
    loadComponent: () =>
      import('./features/bookings/my-bookings/my-bookings.page').then(
        m => m.MyBookingsPage
      )
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile/profile.page').then(
        m => m.ProfilePage
      )
  },
  {
    path: '**',
    redirectTo: 'map'
  }
];