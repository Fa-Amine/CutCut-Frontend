import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChatService } from '../../../core/services/chat.service';
import { SessionService } from '../../../core/services/session.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-barber-messages',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './barber-messages.component.html',
  styleUrl: './barber-messages.component.css'
})
export class BarberMessagesComponent implements OnInit {
  private chatService = inject(ChatService);
  sessionService = inject(SessionService);
  langService = inject(LanguageService);

  partners = signal<any[]>([]);
  isLoading = signal(true);

  ngOnInit() {
    this.loadPartners();
  }

  loadPartners() {
    const barberId = this.sessionService.userId();
    if (!barberId) return;
    this.chatService.getPartners(barberId).subscribe({
      next: (partners) => {
        this.partners.set(partners);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map(p => p[0]?.toUpperCase() ?? '').join('');
  }
}