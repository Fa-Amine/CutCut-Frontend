import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AvatarModule } from 'primeng/avatar';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import { LanguageService } from '../../../core/services/language.service';
import { SessionService } from '../../../core/services/session.service';
import { ProfileService } from '../../../core/services/profile.service';
import { ClientProfile } from '../../../core/models/profile.models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AvatarModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    LoadingSpinnerComponent,
    ErrorAlertComponent
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  private sessionService = inject(SessionService);
  private profileService = inject(ProfileService);
  private fb = inject(FormBuilder);

  langService = inject(LanguageService);

  isLoading = signal(true);
  isSaving = signal(false);
  isEditMode = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  profile = signal<ClientProfile | null>(null);

  profileForm = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]]
  });

  constructor() {
    this.loadProfile();
  }

  loadProfile() {
    const clientId = this.sessionService.userId();

    if (!clientId) {
      this.errorMessage.set('Utilisateur introuvable.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.profileService.getClientProfile(clientId).subscribe({
      next: (response) => {
        this.profile.set(response);
        this.profileForm.patchValue({
          name: response.name,
          email: response.email,
          phone: response.phone
        });
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible de charger le profil.'
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
        phone: profile.phone
      });
    }
    this.isEditMode.set(false);
    this.errorMessage.set('');
  }

  saveProfile() {
    const clientId = this.sessionService.userId();

    if (!clientId) {
      this.errorMessage.set('Utilisateur introuvable.');
      return;
    }

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.profileService.updateClientProfile(clientId, {
      name: this.profileForm.value.name!,
      email: this.profileForm.value.email!,
      phone: this.profileForm.value.phone!
    }).subscribe({
      next: (response) => {
        this.profile.set(response);
        this.isSaving.set(false);
        this.isEditMode.set(false);
        this.successMessage.set('Profil mis à jour avec succès.');
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errorMessage.set(
          error?.error?.message || 'Impossible de mettre à jour le profil.'
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