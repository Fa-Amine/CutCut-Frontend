import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AvatarModule } from 'primeng/avatar';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';

import { LanguageService } from '../../../core/services/language.service';
import { SessionService } from '../../../core/services/session.service';
import { ProfileService } from '../../../core/services/profile.service';
import { BarberProfile } from '../../../core/models/profile.models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';

@Component({
  selector: 'app-barber-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AvatarModule,
    CardModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    MessageModule,
    LoadingSpinnerComponent,
    ErrorAlertComponent
  ],
  templateUrl: './barber-profile.component.html',
  styleUrl: './barber-profile.component.css'
})
export class BarberProfileComponent {
  private sessionService = inject(SessionService);
  private profileService = inject(ProfileService);
  private fb = inject(FormBuilder);

  langService = inject(LanguageService);

  isLoading = signal(true);
  isSaving = signal(false);
  isEditMode = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  profile = signal<BarberProfile | null>(null);

  profileForm = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    shopName: ['', [Validators.required]],
    bio: [''],
    photoUrl: [''],
    price: [0, [Validators.required]]
  });

  constructor() {
    this.loadProfile();
  }

  loadProfile() {
    const barberId = this.sessionService.userId();

    if (!barberId) {
      this.errorMessage.set('Barbier introuvable.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.profileService.getBarberProfile(barberId).subscribe({
      next: (response) => {
        this.profile.set(response);
        this.profileForm.patchValue({
          name: response.name,
          email: response.email,
          phone: response.phone,
          shopName: response.shopName || '',
          bio: response.bio || '',
          photoUrl: response.photoUrl || '',
          price: response.price ?? 0
        });
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible de charger le profil barbier.'
        );
        this.isLoading.set(false);
      }
    });
  }

  startEdit() {
    this.isEditMode.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  cancelEdit() {
    const profile = this.profile();
    if (profile) {
      this.profileForm.patchValue({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        shopName: profile.shopName || '',
        bio: profile.bio || '',
        photoUrl: profile.photoUrl || '',
        price: profile.price ?? 0
      });
    }
    this.isEditMode.set(false);
    this.errorMessage.set('');
  }

  saveProfile() {
    const barberId = this.sessionService.userId();

    if (!barberId) {
      this.errorMessage.set('Barbier introuvable.');
      return;
    }

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.profileService.updateBarberProfile(barberId, {
      name: this.profileForm.value.name!,
      email: this.profileForm.value.email!,
      phone: this.profileForm.value.phone!,
      shopName: this.profileForm.value.shopName!,
      bio: this.profileForm.value.bio || '',
      photoUrl: this.profileForm.value.photoUrl || '',
      price: Number(this.profileForm.value.price)
    }).subscribe({
      next: (response) => {
        this.profile.set(response);
        this.isSaving.set(false);
        this.isEditMode.set(false);
        this.successMessage.set('Profil barbier mis à jour avec succès.');
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errorMessage.set(
          error?.error?.message || 'Impossible de mettre à jour le profil barbier.'
        );
      }
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}