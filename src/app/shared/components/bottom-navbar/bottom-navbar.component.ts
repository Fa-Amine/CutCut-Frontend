import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '../../../core/services/session.service';
import { LanguageService } from '../../../core/services/language.service';
import { WebSocketService } from '../../../core/services/websocket.service';

@Component({
  selector: 'app-bottom-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './bottom-navbar.component.html',
  styleUrl: './bottom-navbar.component.css'
})
export class BottomNavbarComponent implements OnInit, OnDestroy {
  sessionService = inject(SessionService);
  langService = inject(LanguageService);
  wsService = inject(WebSocketService);

  ngOnInit() {
    if (!this.sessionService.isGuest()) {
      this.wsService.connect();
    }
  }

  ngOnDestroy() {
    this.wsService.disconnect();
  }
}