import { Routes } from '@angular/router';

import { LayoutComponent } from './core/layout/layout/layout.component';
import { HomeComponent } from './features/home/home/home.component';
import { NotFoundComponent } from './features/not-found/not-found/not-found.component';

import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';

import { BarberListComponent } from './features/barbers/barber-list/barber-list.component';
import { BarberDetailsComponent } from './features/barbers/barber-details/barber-details.component';

import { MyBookingsComponent } from './features/bookings/my-bookings/my-bookings.component';
import { ProfileComponent } from './features/profile/profile/profile.component';

import { DashboardComponent } from './features/barber/dashboard/dashboard.component';
import { BarberProfileComponent } from './features/barber/barber-profile/barber-profile.component';
import { AvailabilityComponent } from './features/barber/availability/availability.component';
import { BarberBookingsComponent } from './features/barber/barber-bookings/barber-bookings.component';

import { authGuard } from './core/guards/auth.guard';
import { clientGuard } from './core/guards/client.guard';
import { barberGuard } from './core/guards/barber.guard';
import { guestGuard } from './core/guards/guest.guard';
import { DashboardComponent as AdminDashboardComponent } from './features/admin/dashboard/dashboard.component';
import { adminGuard } from './core/guards/admin.guard';


export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', component: HomeComponent },

      { path: 'barbers', component: BarberListComponent },
      { path: 'barbers/:id', component: BarberDetailsComponent },

      { path: 'bookings', component: MyBookingsComponent, canActivate: [clientGuard] },
      { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },

      { path: 'barber/dashboard', component: DashboardComponent, canActivate: [barberGuard] },
      { path: 'barber/profile', component: BarberProfileComponent, canActivate: [barberGuard] },
      { path: 'barber/availability', component: AvailabilityComponent, canActivate: [barberGuard] },
      { path: 'barber/bookings', component: BarberBookingsComponent, canActivate: [barberGuard] },

      { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
      { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
      { path: 'admin/dashboard', component: AdminDashboardComponent, canActivate: [adminGuard] },   
    ] 
  },
  { path: '**', component: NotFoundComponent }
];