import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { LanguageService } from '../../../core/services/language.service';
import { BarberService } from '../../../core/services/barber.service';
import { AvailabilityService } from '../../../core/services/availability.service';
import { AvailabilitySlot } from '../../../core/models/availability.models';
import { BarberListItem } from '../../../core/models/barber.models';
import { SessionService } from '../../../core/services/session.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, CardModule, AvatarModule, TagModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  langService = inject(LanguageService);
  private barberService = inject(BarberService);
  private availabilityService = inject(AvailabilityService);
  sessionService = inject(SessionService);

  isLoading = signal(true);
  allBarbers = signal<BarberListItem[]>([]);
  previewSlots = signal<AvailabilitySlot[]>([]);

  featuredBarbers = computed(() => this.allBarbers().slice(0, 3));

  topBarbers = computed(() =>
    [...this.allBarbers()]
      .filter(b => b.averageRating && b.averageRating > 0)
      .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
      .slice(0, 3)
  );

  previewBarber = computed(() => this.allBarbers()[0] ?? null);

  constructor() {
    this.loadHomeData();
  }

  loadHomeData() {
    this.isLoading.set(true);
    this.barberService.getAllBarbers().subscribe({
      next: (barbers) => {
        this.allBarbers.set(barbers);
        this.isLoading.set(false);
        const firstBarber = barbers[0];
        if (!firstBarber) {
          this.previewSlots.set([]);
          return;
        }
        this.loadPreviewSlots(firstBarber.id);
      },
      error: (error) => {
        this.allBarbers.set([]);
        this.previewSlots.set([]);
        this.isLoading.set(false);
      }
    });
  }

  loadPreviewSlots(barberId: number) {
    this.availabilityService.getAvailableSlotsByBarber(barberId).subscribe({
      next: (slots) => {
        const available = slots
          .filter(slot => !slot.booked)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .slice(0, 3);
        this.previewSlots.set(available);
      },
      error: () => {
        this.previewSlots.set([]);
      }
    });
  }

  getStars(rating: number): string {
    const full = Math.floor(rating);
    return '⭐'.repeat(full);
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '').join('');
  }

  formatTime(dateTime: string): string {
    return new Date(dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}