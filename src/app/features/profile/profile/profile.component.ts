import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AvatarModule } from 'primeng/avatar';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { HttpClient } from '@angular/common/http';
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
    CommonModule, ReactiveFormsModule,
    AvatarModule, CardModule, ButtonModule,
    InputTextModule, MessageModule,
    LoadingSpinnerComponent, ErrorAlertComponent
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  private sessionService = inject(SessionService);
  private profileService = inject(ProfileService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  langService = inject(LanguageService);

  isLoading = signal(true);
  isSaving = signal(false);
  isEditMode = signal(false);
  isUploadingPhoto = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  profile = signal<ClientProfile | null>(null);
  photoUrl = signal('');

  private readonly CLOUDINARY_CLOUD_NAME = 'delf4ovww';
  private readonly CLOUDINARY_UPLOAD_PRESET = 'barbergo_upload';

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
        this.photoUrl.set((response as any).photoUrl || '');
        this.profileForm.patchValue({
          name: response.name,
          email: response.email,
          phone: response.phone
        });
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible de charger le profil.');
        this.isLoading.set(false);
      }
    });
  }

  // ✅ Upload photo Cloudinary
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.isUploadingPhoto.set(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.CLOUDINARY_UPLOAD_PRESET);
    this.http.post<any>(
      `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData
    ).subscribe({
      next: (response) => {
        this.photoUrl.set(response.secure_url);
        this.isUploadingPhoto.set(false);
        this.successMessage.set(this.langService.isArabic() ? 'تم رفع الصورة !' : 'Photo uploadee !');
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: () => {
        this.isUploadingPhoto.set(false);
        this.errorMessage.set('Impossible d\'uploader la photo.');
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
      phone: this.profileForm.value.phone!,
      photoUrl: this.photoUrl()
    }).subscribe({
      next: (response) => {
        this.profile.set(response);
        this.isSaving.set(false);
        this.isEditMode.set(false);
        this.successMessage.set(this.langService.isArabic() ? 'تم تحديث الملف الشخصي !' : 'Profil mis a jour !');
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errorMessage.set(error?.error?.message || 'Impossible de mettre a jour le profil.');
      }
    });
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '').join('');
  }
}