import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id: number;
  sender: { id: number; name: string; };
  receiver: { id: number; name: string; };
  content: string;
  sentAt: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  sendMessage(senderId: number, receiverId: number, content: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/chat/send`, {
      senderId, receiverId, content
    });
  }

  getConversation(userId1: number, userId2: number): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.baseUrl}/chat/${userId1}/${userId2}`);
  }

  getPartners(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/chat/partners/${userId}`);
  }

  markAsRead(userId1: number, userId2: number): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/chat/read/${userId1}/${userId2}`, {});
  }
}