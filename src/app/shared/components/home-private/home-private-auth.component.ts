import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../../core/services/session.service';
import { PrivateHomeService } from '../../../core/services/private-home-service.service';

@Component({
  selector: 'app-home-private-auth', standalone: true, imports: [CommonModule, RouterLink],
  template: `
    <section *ngIf="!api.ready()" class="session-notice" role="status">
      <h3>Reconnecte-toi pour actualiser ta session</h3>
      <p>Utilise la page de connexion habituelle pour accéder à ton espace à domicile.
        Si ce message revient après connexion, le serveur doit être mis à jour.</p>
      <a routerLink="/login">Aller à la connexion</a>
    </section>`,
  styles: [`.session-notice{padding:18px;border:1px solid #d9e1e8;border-radius:16px;background:#fff;margin-bottom:20px}h3{font-size:16px;margin:0 0 8px}p{font-size:14px;line-height:1.6}a{display:inline-block;padding:12px 16px;background:#171717;color:#fff;border-radius:10px;text-decoration:none}`],
})
export class HomePrivateAuthComponent {
  readonly api = inject(PrivateHomeService);
  readonly session = inject(SessionService);
  @Output() unlocked = new EventEmitter<void>();
}
