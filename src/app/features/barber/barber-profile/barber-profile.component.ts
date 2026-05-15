import { Component, inject, signal, AfterViewChecked } from '@angular/core';
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
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../../core/services/language.service';
import { SessionService } from '../../../core/services/session.service';
import { ProfileService } from '../../../core/services/profile.service';
import { BarberProfile } from '../../../core/models/profile.models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';
import { SafeUrlPipe } from '../../../core/pipes/safe-url.pipe';
import { BarberPhotoService, BarberPhoto } from '../../../core/services/barber-photo.service';

declare const L: any;

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
    ErrorAlertComponent,
    SafeUrlPipe
  ],
  templateUrl: './barber-profile.component.html',
  styleUrl: './barber-profile.component.css'
})
export class BarberProfileComponent implements AfterViewChecked {
  private sessionService = inject(SessionService);
  private profileService = inject(ProfileService);
  private barberPhotoService = inject(BarberPhotoService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  langService = inject(LanguageService);

  isLoading = signal(true);
  isSaving = signal(false);
  isEditMode = signal(false);
  isUploadingPhoto = signal(false);
  isUploadingGallery = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  profile = signal<BarberProfile | null>(null);
  mapUrl = signal('');
  photos = signal<BarberPhoto[]>([]);
  newCaption = signal('');

  private editMap: any = null;
  private editMarker: any = null;
  private mapInitialized = false;

  private readonly CLOUDINARY_CLOUD_NAME = 'delf4ovww';
  private readonly CLOUDINARY_UPLOAD_PRESET = 'barbergo_upload';

  profileForm = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    shopName: ['', [Validators.required]],
    bio: [''],
    photoUrl: [''],
    price: [0, [Validators.required]],
    address: [''],
    latitude: [null as number | null],
    longitude: [null as number | null]
  });

  constructor() {
    this.loadLeaflet();
    this.loadProfile();
  }

  loadLeaflet() {
    if (!(window as any).L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      document.head.appendChild(script);
    }
  }

  ngAfterViewChecked() {
    if (this.isEditMode() && !this.mapInitialized) {
      const mapEl = document.getElementById('edit-map');
      if (mapEl && (window as any).L) {
        this.initEditMap();
      }
    }
    if (!this.isEditMode()) {
      this.mapInitialized = false;
      if (this.editMap) {
        this.editMap.remove();
        this.editMap = null;
        this.editMarker = null;
      }
    }
  }

  initEditMap() {
    this.mapInitialized = true;
    const lat = this.profileForm.value.latitude || 33.5731;
    const lng = this.profileForm.value.longitude || -7.5898;
    this.editMap = L.map('edit-map').setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.editMap);
    if (this.profileForm.value.latitude && this.profileForm.value.longitude) {
      this.editMarker = L.marker([lat, lng]).addTo(this.editMap);
    }
    this.editMap.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      if (this.editMarker) {
        this.editMarker.setLatLng([lat, lng]);
      } else {
        this.editMarker = L.marker([lat, lng]).addTo(this.editMap);
      }
      this.profileForm.patchValue({ latitude: lat, longitude: lng });
      this.http.get<any>(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      ).subscribe({
        next: (result) => {
          if (result?.display_name) {
            this.profileForm.patchValue({ address: result.display_name });
          }
        }
      });
    });
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.isUploadingPhoto.set(true);
    this.errorMessage.set('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.CLOUDINARY_UPLOAD_PRESET);
    this.http.post<any>(
      `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData
    ).subscribe({
      next: (response) => {
        this.profileForm.patchValue({ photoUrl: response.secure_url });
        this.isUploadingPhoto.set(false);
        this.successMessage.set('Photo uploadée avec succès !');
      },
      error: () => {
        this.isUploadingPhoto.set(false);
        this.errorMessage.set('Impossible d\'uploader la photo.');
      }
    });
  }

  onGalleryPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.isUploadingGallery.set(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.CLOUDINARY_UPLOAD_PRESET);
    this.http.post<any>(
      `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData
    ).subscribe({
      next: (response) => {
        const barberId = this.sessionService.userId();
        if (!barberId) return;
        this.barberPhotoService.addBarberPhoto(
          barberId,
          response.secure_url,
          this.newCaption()
        ).subscribe({
          next: (photo) => {
            this.photos.update(photos => [photo, ...photos]);
            this.newCaption.set('');
            this.isUploadingGallery.set(false);
            this.successMessage.set('Photo ajoutée à la galerie !');
          },
          error: () => {
            this.isUploadingGallery.set(false);
            this.errorMessage.set('Impossible d\'ajouter la photo.');
          }
        });
      },
      error: () => {
        this.isUploadingGallery.set(false);
        this.errorMessage.set('Impossible d\'uploader la photo.');
      }
    });
  }

  deletePhoto(photoId: number) {
    const barberId = this.sessionService.userId();
    if (!barberId) return;
    this.barberPhotoService.deleteBarberPhoto(barberId, photoId).subscribe({
      next: () => {
        this.photos.update(photos => photos.filter(p => p.id !== photoId));
        this.successMessage.set('Photo supprimée !');
      }
    });
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
          price: response.price ?? 0,
          address: response.address || '',
          latitude: response.latitude ?? null,
          longitude: response.longitude ?? null
        });
        this.updateMapUrl(response.latitude, response.longitude);
        this.isLoading.set(false);
        this.loadPhotos(barberId);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible de charger le profil barbier.');
        this.isLoading.set(false);
      }
    });
  }

  loadPhotos(barberId: number) {
    this.barberPhotoService.getBarberPhotos(barberId).subscribe({
      next: (photos) => this.photos.set(photos),
      error: () => {}
    });
  }

  updateMapUrl(lat?: number, lng?: number) {
    if (lat && lng) {
      this.mapUrl.set(
        `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lng}`
      );
    } else {
      this.mapUrl.set('');
    }
  }

  startEdit() {
    this.isEditMode.set(true);
    this.mapInitialized = false;
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
        price: profile.price ?? 0,
        address: profile.address || '',
        latitude: profile.latitude ?? null,
        longitude: profile.longitude ?? null
      });
      this.updateMapUrl(profile.latitude, profile.longitude);
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
      price: Number(this.profileForm.value.price),
      address: this.profileForm.value.address || '',
      latitude: this.profileForm.value.latitude ?? undefined,
      longitude: this.profileForm.value.longitude ?? undefined
    }).subscribe({
      next: (response) => {
        this.profile.set(response);
        this.updateMapUrl(response.latitude, response.longitude);
        this.isSaving.set(false);
        this.isEditMode.set(false);
        this.successMessage.set('Profil barbier mis à jour avec succès.');
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errorMessage.set(error?.error?.message || 'Impossible de mettre à jour le profil barbier.');
      }
    });
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '').join('');
  }
}