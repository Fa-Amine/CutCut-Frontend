import { Component, inject, signal, AfterViewChecked, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
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
import { BarberServiceService } from '../../../core/services/barber-service.service';
import { BarberServiceItem } from '../../../core/models/booking.models';
import { HomeServiceService } from '../../../core/services/home-service.service';
import { HomeServiceRequest } from '../../../core/models/barber.models';

declare const L: any;

interface PredefinedServiceItem {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  isImage: boolean;
}

@Component({
  selector: 'app-barber-profile',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    AvatarModule, CardModule, TagModule, ButtonModule,
    InputTextModule, InputNumberModule, TextareaModule, MessageModule,
    LoadingSpinnerComponent, ErrorAlertComponent, SafeUrlPipe
  ],
  templateUrl: './barber-profile.component.html',
  styleUrl: './barber-profile.component.css'
})
export class BarberProfileComponent implements AfterViewChecked {
  private sessionService = inject(SessionService);
  private profileService = inject(ProfileService);
  private barberPhotoService = inject(BarberPhotoService);
  private barberServiceService = inject(BarberServiceService);
  private homeServiceService = inject(HomeServiceService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  langService = inject(LanguageService);

  isLoading = signal(true);
  isSaving = signal(false);
  isEditMode = signal(false);
  isUploadingPhoto = signal(false);
  isUploadingGallery = signal(false);
  isLocating = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  locationError = signal('');
  profile = signal<BarberProfile | null>(null);
  mapUrl = signal('');
  photos = signal<BarberPhoto[]>([]);
  newCaption = signal('');

  // Preview photo avant sauvegarde
  previewPhotoUrl = signal('');

  barberServices = signal<BarberServiceItem[]>([]);
  showAddService = signal(false);
  editingServiceId = signal<number | null>(null);
  newServiceName = '';
  newServicePrice: number = 0;
  newServiceDescription = '';
  newServiceImageUrl = signal('');
  isUploadingServiceImage = signal(false);

  selectedPredefinedService = signal<PredefinedServiceItem | null>(null);
  predefinedServicePrice: number = 0;
  showPredefinedPriceInput = signal(false);

  homeServiceRequest = signal<HomeServiceRequest | null>(null);
  diplomaUrl = signal('');
  cinUrl = signal('');
  selfieUrl = signal('');
  isUploadingDiploma = signal(false);
  isUploadingCin = signal(false);
  isUploadingSelfie = signal(false);
  isSubmittingHomeService = signal(false);
  isUploadingDoc = () => this.isUploadingDiploma() || this.isUploadingCin() || this.isUploadingSelfie();

  private editMap: any = null;
  private editMarker: any = null;
  private mapInitialized = false;

  private readonly CLOUDINARY_CLOUD_NAME = 'delf4ovww';
  private readonly CLOUDINARY_UPLOAD_PRESET = 'barbergo_upload';

  predefinedServicesList: PredefinedServiceItem[] = [
    { id: 'coupe', name: 'Coupe de cheveux', nameAr: 'قصة شعر', icon: '/images/services/service-coupe.png', isImage: true },
    { id: 'barbe', name: 'Barbe', nameAr: 'حلاقة اللحية', icon: '/images/services/service-barbe.png', isImage: true },
    { id: 'brushing', name: 'Brushing', nameAr: 'مكواة الشعر', icon: '/images/services/service-brushing.png', isImage: true },
    { id: 'keratine', name: 'Keratine / Proteine', nameAr: 'كيراتين / بروتين', icon: '/images/services/service-keratine.png', isImage: true },
    { id: 'soin', name: 'Soin du visage', nameAr: 'عناية بالوجه', icon: '🧖', isImage: false }
  ];

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
      if (mapEl && (window as any).L) this.initEditMap();
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

  useMyLocation() {
    this.locationError.set('');
    if (!navigator.geolocation) {
      this.locationError.set('La geolocalisation n\'est pas supportee.');
      return;
    }
    this.isLocating.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.profileForm.patchValue({ latitude: lat, longitude: lng });
        if (this.editMap) {
          this.editMap.setView([lat, lng], 17);
          if (this.editMarker) {
            this.editMarker.setLatLng([lat, lng]);
          } else {
            this.editMarker = L.marker([lat, lng]).addTo(this.editMap);
          }
        }
        this.http.get<any>(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        ).subscribe({
          next: (result) => {
            if (result?.display_name) {
              this.profileForm.patchValue({ address: result.display_name });
            }
          }
        });
        this.isLocating.set(false);
        this.successMessage.set('Position detectee !');
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      (error) => {
        this.isLocating.set(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            this.locationError.set('Acces a la localisation refuse.');
            break;
          default:
            this.locationError.set('Impossible de detecter la position.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  loadServices(barberId: number) {
    this.barberServiceService.getServices(barberId).subscribe({
      next: (services) => this.barberServices.set(services),
      error: () => {}
    });
  }

  selectPredefinedService(service: PredefinedServiceItem) {
    this.selectedPredefinedService.set(service);
    this.predefinedServicePrice = 0;
    this.showPredefinedPriceInput.set(true);
    this.showAddService.set(false);
  }

  confirmPredefinedService() {
    const service = this.selectedPredefinedService();
    const barberId = this.sessionService.userId();
    if (!service || !barberId || !this.predefinedServicePrice) return;
    const imageUrl = service.isImage ? service.icon : '';
    const payload = {
      name: this.langService.isArabic() ? service.nameAr : service.name,
      price: this.predefinedServicePrice,
      imageUrl: imageUrl
    };
    this.barberServiceService.addService(barberId, payload).subscribe({
      next: (newService) => {
        this.barberServices.update(services => [...services, newService]);
        this.cancelPredefinedForm();
        this.successMessage.set('Service ajoute !');
        setTimeout(() => this.successMessage.set(''), 3000);
      }
    });
  }

  cancelPredefinedForm() {
    this.selectedPredefinedService.set(null);
    this.predefinedServicePrice = 0;
    this.showPredefinedPriceInput.set(false);
  }

  onServiceImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.isUploadingServiceImage.set(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.CLOUDINARY_UPLOAD_PRESET);
    this.http.post<any>(
      `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData
    ).subscribe({
      next: (response) => {
        this.newServiceImageUrl.set(response.secure_url);
        this.isUploadingServiceImage.set(false);
      },
      error: () => { this.isUploadingServiceImage.set(false); }
    });
  }

  saveService() {
    const barberId = this.sessionService.userId();
    if (!barberId || !this.newServiceName || !this.newServicePrice) return;
    const payload = {
      name: this.newServiceName,
      price: this.newServicePrice,
      description: this.newServiceDescription || '',
      imageUrl: this.newServiceImageUrl()
    };
    if (this.editingServiceId()) {
      this.barberServiceService.updateService(barberId, this.editingServiceId()!, payload).subscribe({
        next: (updated) => {
          this.barberServices.update(services =>
            services.map(s => s.id === updated.id ? updated : s)
          );
          this.cancelServiceForm();
          this.successMessage.set('Service modifie !');
          setTimeout(() => this.successMessage.set(''), 3000);
        }
      });
    } else {
      this.barberServiceService.addService(barberId, payload).subscribe({
        next: (newService) => {
          this.barberServices.update(services => [...services, newService]);
          this.cancelServiceForm();
          this.successMessage.set('Service ajoute !');
          setTimeout(() => this.successMessage.set(''), 3000);
        }
      });
    }
  }

  editService(service: BarberServiceItem) {
    this.editingServiceId.set(service.id);
    this.newServiceName = service.name;
    this.newServicePrice = service.price;
    this.newServiceDescription = (service as any).description || '';
    this.newServiceImageUrl.set(service.imageUrl || '');
    this.showAddService.set(true);
    this.cancelPredefinedForm();
  }

  deleteService(serviceId: number) {
    const barberId = this.sessionService.userId();
    if (!barberId) return;
    this.barberServiceService.deleteService(barberId, serviceId).subscribe({
      next: () => {
        this.barberServices.update(services => services.filter(s => s.id !== serviceId));
        this.successMessage.set('Service supprime !');
        setTimeout(() => this.successMessage.set(''), 3000);
      }
    });
  }

  cancelServiceForm() {
    this.showAddService.set(false);
    this.editingServiceId.set(null);
    this.newServiceName = '';
    this.newServicePrice = 0;
    this.newServiceDescription = '';
    this.newServiceImageUrl.set('');
  }

  loadHomeServiceRequest(barberId: number) {
    this.homeServiceService.getByBarber(barberId).subscribe({
      next: (req) => { if (req) this.homeServiceRequest.set(req); },
      error: () => {}
    });
  }

  onDocumentSelected(event: Event, type: 'diploma' | 'cin' | 'selfie') {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (type === 'diploma') this.isUploadingDiploma.set(true);
    if (type === 'cin') this.isUploadingCin.set(true);
    if (type === 'selfie') this.isUploadingSelfie.set(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.CLOUDINARY_UPLOAD_PRESET);
    this.http.post<any>(
      `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData
    ).subscribe({
      next: (response) => {
        if (type === 'diploma') { this.diplomaUrl.set(response.secure_url); this.isUploadingDiploma.set(false); }
        if (type === 'cin') { this.cinUrl.set(response.secure_url); this.isUploadingCin.set(false); }
        if (type === 'selfie') { this.selfieUrl.set(response.secure_url); this.isUploadingSelfie.set(false); }
      },
      error: () => {
        this.isUploadingDiploma.set(false);
        this.isUploadingCin.set(false);
        this.isUploadingSelfie.set(false);
      }
    });
  }

  submitHomeService() {
    const barberId = this.sessionService.userId();
    if (!barberId) return;
    this.isSubmittingHomeService.set(true);
    this.homeServiceService.submitRequest(
      barberId, this.diplomaUrl(), this.cinUrl(), this.selfieUrl()
    ).subscribe({
      next: (req) => {
        this.homeServiceRequest.set(req);
        this.isSubmittingHomeService.set(false);
        this.successMessage.set('Demande soumise !');
        setTimeout(() => this.successMessage.set(''), 4000);
      },
      error: () => { this.isSubmittingHomeService.set(false); }
    });
  }

  // ✅ Upload photo avec preview immédiat
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    // Preview local immédiat
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewPhotoUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);

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
        this.previewPhotoUrl.set('');
        this.isUploadingPhoto.set(false);
        this.successMessage.set('Photo uploadee !');
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: () => {
        this.previewPhotoUrl.set('');
        this.isUploadingPhoto.set(false);
        this.errorMessage.set('Impossible d\'uploader la photo.');
      }
    });
  }

  onGalleryPhotoSelected(event: Event, category: string) {
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
          barberId, response.secure_url, this.newCaption(), category
        ).subscribe({
          next: (photo) => {
            this.photos.update(photos => [photo, ...photos]);
            this.newCaption.set('');
            this.isUploadingGallery.set(false);
            this.successMessage.set('Photo ajoutee !');
            setTimeout(() => this.successMessage.set(''), 3000);
          },
          error: () => { this.isUploadingGallery.set(false); }
        });
      },
      error: () => { this.isUploadingGallery.set(false); }
    });
  }

  deletePhoto(photoId: number) {
    const barberId = this.sessionService.userId();
    if (!barberId) return;
    this.barberPhotoService.deleteBarberPhoto(barberId, photoId).subscribe({
      next: () => {
        this.photos.update(photos => photos.filter(p => p.id !== photoId));
        this.successMessage.set('Photo supprimee !');
        setTimeout(() => this.successMessage.set(''), 3000);
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
        this.loadServices(barberId);
        this.loadHomeServiceRequest(barberId);
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
    this.locationError.set('');
    this.previewPhotoUrl.set('');
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
    this.locationError.set('');
    this.previewPhotoUrl.set('');
  }

  saveProfile() {
    const barberId = this.sessionService.userId();
    if (!barberId) {
      this.errorMessage.set('Barbier introuvable.');
      return;
    }
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.errorMessage.set('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (this.isUploadingPhoto()) {
      this.errorMessage.set('Veuillez attendre la fin de l\'upload de la photo.');
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
        this.successMessage.set('Profil mis a jour avec succes !');
        setTimeout(() => this.successMessage.set(''), 4000);
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

  // ✅ Photo à afficher (preview ou photo sauvegardée)
  get displayPhotoUrl(): string {
    return this.previewPhotoUrl() || this.profileForm.value.photoUrl || this.profile()?.photoUrl || '';
  }
}