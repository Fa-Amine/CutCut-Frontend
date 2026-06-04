import { Component, inject, signal, OnInit, OnDestroy, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChatService, ChatMessage } from '../../core/services/chat.service';
import { SessionService } from '../../core/services/session.service';
import { WebSocketService } from '../../core/services/websocket.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  private route = inject(ActivatedRoute);
  private chatService = inject(ChatService);
  sessionService = inject(SessionService);
  private wsService = inject(WebSocketService);

  messages = signal<ChatMessage[]>([]);
  newMessage = signal('');
  isLoading = signal(true);
  isSending = signal(false);
  partnerName = signal('');
  partnerId = signal<number>(0);

  private shouldScroll = false;
  private wsSubscription: any = null;
  private refreshInterval: any = null;

  ngOnInit() {
    const partnerId = Number(this.route.snapshot.paramMap.get('id'));
    this.partnerId.set(partnerId);
    this.loadMessages(partnerId);
    this.subscribeToWebSocket(partnerId);

    // ✅ Rafraîchir toutes les 5 secondes
    this.refreshInterval = setInterval(() => {
      this.loadMessagesSilently(partnerId);
    }, 5000);
  }

  // ✅ Charger le nom du partenaire depuis les messages
  loadPartnerName(msgs: ChatMessage[]) {
    const myId = this.sessionService.userId();
    if (msgs.length > 0) {
      const msg = msgs[0];
      if (msg.sender.id === myId) {
        this.partnerName.set(msg.receiver.name);
      } else {
        this.partnerName.set(msg.sender.name);
      }
    } else {
      this.partnerName.set('Utilisateur');
    }
  }

  loadMessages(partnerId: number) {
    const myId = this.sessionService.userId();
    if (!myId) return;
    this.isLoading.set(true);
    this.chatService.getConversation(myId, partnerId).subscribe({
      next: (msgs) => {
        this.messages.set(msgs);
        this.loadPartnerName(msgs);
        this.isLoading.set(false);
        this.shouldScroll = true;
        this.chatService.markAsRead(myId, partnerId).subscribe();
      },
      error: () => this.isLoading.set(false)
    });
  }

  loadMessagesSilently(partnerId: number) {
    const myId = this.sessionService.userId();
    if (!myId) return;
    this.chatService.getConversation(myId, partnerId).subscribe({
      next: (msgs) => {
        if (msgs.length !== this.messages().length) {
          this.messages.set(msgs);
          this.loadPartnerName(msgs);
          this.shouldScroll = true;
          this.chatService.markAsRead(myId, partnerId).subscribe();
        }
      },
      error: () => {}
    });
  }

  subscribeToWebSocket(partnerId: number) {
    const myId = this.sessionService.userId();
    if (!myId) return;
    const client = (this.wsService as any).client;
    if (client?.active) {
      this.wsSubscription = client.subscribe(`/topic/chat/${myId}`, () => {
        this.loadMessagesSilently(partnerId);
      });
    }
  }

  sendMessage() {
    const content = this.newMessage().trim();
    const myId = this.sessionService.userId();
    const partnerId = this.partnerId();
    if (!content || !myId) return;

    this.isSending.set(true);
    this.chatService.sendMessage(myId, partnerId, content).subscribe({
      next: (msg) => {
        this.messages.update(msgs => [...msgs, msg]);
        this.newMessage.set('');
        this.isSending.set(false);
        this.shouldScroll = true;
      },
      error: () => this.isSending.set(false)
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  scrollToBottom() {
    try {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }

  isMyMessage(msg: ChatMessage): boolean {
    return msg.sender.id === this.sessionService.userId();
  }

  formatTime(dateTime: string): string {
    return new Date(dateTime).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatDate(dateTime: string): string {
    return new Date(dateTime).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short'
    });
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}