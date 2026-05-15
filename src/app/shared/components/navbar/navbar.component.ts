import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '../../../core/services/language.service';
import { SessionService } from '../../../core/services/session.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/websocket.service';

interface NavLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ButtonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  langService = inject(LanguageService);
  sessionService = inject(SessionService);
  wsService = inject(WebSocketService);
  private router = inject(Router);

  mobileMenuOpen = signal(false);
  showNotifications = signal(false);

  navLinks = computed<NavLink[]>(() => {
    if (this.sessionService.isAdmin()) {
      return [{ label: this.langService.t().dashboard, path: '/admin/dashboard' }];
    }
    if (this.sessionService.isBarber()) {
      return [
        { label: this.langService.t().dashboard, path: '/barber/dashboard' },
        { label: this.langService.t().bookings, path: '/barber/bookings' },
        { label: this.langService.t().availabilityNav, path: '/barber/availability' },
        { label: this.langService.t().barberProfileNav, path: '/barber/profile' }
      ];
    }
    if (this.sessionService.isClient()) {
      return [
        { label: this.langService.t().home, path: '/' },
        { label: this.langService.t().barbers, path: '/barbers' },
        { label: this.langService.t().bookings, path: '/bookings' },
        { label: this.langService.t().profile, path: '/profile' }
      ];
    }
    return [
      { label: this.langService.t().home, path: '/' },
      { label: this.langService.t().barbers, path: '/barbers' }
    ];
  });

  ngOnInit() {
    if (!this.sessionService.isGuest()) {
      this.wsService.connect();
    }
  }

  ngOnDestroy() {
    this.wsService.disconnect();
  }

  toggleNotifications() {
    this.showNotifications.update(v => !v);
    if (this.showNotifications()) {
      this.wsService.unreadCount.set(0);
    }
  }

  clearNotifications() {
    this.wsService.clearNotifications();
    this.showNotifications.set(false);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(value => !value);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  setLanguage(lang: 'fr' | 'ar') {
    this.langService.setLanguage(lang);
  }

  logout() {
    this.wsService.disconnect();
    this.authService.logout();
    this.closeMobileMenu();
    this.router.navigate(['/']);
  }
}