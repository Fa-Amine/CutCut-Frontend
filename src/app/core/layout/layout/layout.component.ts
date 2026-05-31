import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { BottomNavbarComponent } from '../../../shared/components/bottom-navbar/bottom-navbar.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, BottomNavbarComponent, FooterComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  private router = inject(Router);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const appShell = document.querySelector('.app-shell');
      if (appShell) appShell.scrollTop = 0;
      window.scrollTo(0, 0);
    });
  }
}