import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import {
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';

import { ButtonModule } from 'primeng/button';

import { LanguageService } from '../../../core/services/language.service';
import { SessionService } from '../../../core/services/session.service';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/websocket.service';

interface NavLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);

  langService = inject(LanguageService);
  sessionService = inject(SessionService);
  wsService = inject(WebSocketService);

  mobileMenuOpen = signal(false);
  showNotifications = signal(false);

  navLinks = computed<NavLink[]>(() => {
    if (this.sessionService.isAdmin()) {
      return [
        {
          label: this.langService.t().dashboard,
          path: '/admin/dashboard',
        },
      ];
    }

    if (this.sessionService.isBarber()) {
      return [
        {
          label: this.langService.t().dashboard,
          path: '/barber/dashboard',
        },
        {
          label: this.langService.t().bookings,
          path: '/barber/bookings',
        },
        {
          label: this.langService.t().availabilityNav,
          path: '/barber/availability',
        },
        {
          label: '💬 Messages',
          path: '/barber/messages',
        },
        {
          label: this.langService.t().barberProfileNav,
          path: '/barber/profile',
        },
      ];
    }

    if (this.sessionService.isClient()) {
      return [
        {
          label: this.langService.t().home,
          path: '/',
        },
        {
          label: this.langService.t().barbers,
          path: '/barbers',
        },
        {
          label: this.langService.isArabic()
            ? 'في المنزل'
            : 'À domicile',
          path: '/home-service',
        },
        {
          label: this.langService.t().bookings,
          path: '/bookings',
        },
        {
          label: this.langService.t().profile,
          path: '/profile',
        },
      ];
    }

    return [
      {
        label: this.langService.t().home,
        path: '/',
      },
      {
        label: this.langService.t().barbers,
        path: '/barbers',
      },
      {
        label: this.langService.isArabic()
          ? 'في المنزل'
          : 'À domicile',
        path: '/home-service',
      },
    ];
  });

  ngOnInit(): void {
    if (!this.sessionService.isGuest()) {
      this.wsService.connect();
    }
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
  }

  toggleNotifications(): void {
    this.showNotifications.update((value) => !value);

    if (this.showNotifications()) {
      this.wsService.unreadCount.set(0);
    }
  }

  clearNotifications(): void {
    this.wsService.clearNotifications();
    this.showNotifications.set(false);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((value) => !value);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  setLanguage(lang: 'fr' | 'ar'): void {
    this.langService.setLanguage(lang);
  }

  logout(): void {
    this.wsService.disconnect();
    this.authService.logout();
    this.closeMobileMenu();
    this.router.navigate(['/']);
  }
}