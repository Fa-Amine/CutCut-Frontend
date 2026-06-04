<section class="barber-profile-page">
  <div class="barber-profile-shell">
    <div class="page-header">
      <span class="page-kicker">{{ langService.t().barberProfileNav }}</span>
      <h1>{{ langService.t().barberProfileNav }}</h1>
      <p>Consultez et modifiez les informations de votre activité.</p>
    </div>

    <p-message *ngIf="successMessage()" severity="success" [text]="successMessage()"></p-message>
    <app-loading-spinner *ngIf="isLoading()" message="Chargement du profil barbier..."></app-loading-spinner>
    <app-error-alert *ngIf="!isLoading() && errorMessage()" title="Erreur" [message]="errorMessage()"></app-error-alert>

    <p-card *ngIf="!isLoading() && !errorMessage() && profile()">
      <div class="profile-card">

        <div class="profile-top">
          <div class="photo-container">
            <ng-container *ngIf="profileForm.value.photoUrl || profile()!.photoUrl; else barberAvatar">
              <img [src]="profileForm.value.photoUrl || profile()!.photoUrl!" [alt]="profile()!.name" class="barber-photo-large" />
            </ng-container>
            <ng-template #barberAvatar>
              <p-avatar [label]="getInitials(profile()!.name)" shape="circle" size="xlarge"></p-avatar>
            </ng-template>
            <div *ngIf="isEditMode()" class="photo-upload-btn" style="margin-top:8px;">
              <label for="photoInput" style="cursor:pointer; background:#1A1A1A; color:#FAFAF7; padding:6px 12px; border-radius:8px; font-size:0.85rem;">
                📷 Changer la photo
              </label>
              <input id="photoInput" type="file" accept="image/*" style="display:none" (change)="onPhotoSelected($event)" />
              <span *ngIf="isUploadingPhoto()" style="color:#64748b; font-size:0.85rem; margin-left:8px;">Envoi en cours...</span>
            </div>
          </div>
          <div>
            <h2>{{ profile()!.name }}</h2>
            <p>{{ profile()!.shopName || 'CutCut' }}</p>
          </div>
        </div>

        <div class="profile-tags">
          <p-tag *ngIf="profile()!.price !== undefined && profile()!.price !== null"
            [value]="profile()!.price + ' MAD'" severity="info"></p-tag>
          <p-tag *ngIf="profile()!.averageRating !== undefined && profile()!.averageRating !== null"
            [value]="'⭐ ' + profile()!.averageRating" severity="success"></p-tag>
        </div>

        <form [formGroup]="profileForm" class="profile-grid">
          <div class="info-box">
            <span>Nom</span>
            <strong *ngIf="!isEditMode()">{{ profile()!.name }}</strong>
            <input *ngIf="isEditMode()" pInputText formControlName="name" class="w-full" />
          </div>
          <div class="info-box">
            <span>Email</span>
            <strong *ngIf="!isEditMode()">{{ profile()!.email }}</strong>
            <input *ngIf="isEditMode()" pInputText formControlName="email" class="w-full" />
          </div>
          <div class="info-box">
            <span>Téléphone</span>
            <strong *ngIf="!isEditMode()">{{ profile()!.phone }}</strong>
            <input *ngIf="isEditMode()" pInputText formControlName="phone" class="w-full" />
          </div>
          <div class="info-box">
            <span>Salon</span>
            <strong *ngIf="!isEditMode()">{{ profile()!.shopName || '-' }}</strong>
            <input *ngIf="isEditMode()" pInputText formControlName="shopName" class="w-full" />
          </div>
          <div class="info-box">
            <span>Prix</span>
            <strong *ngIf="!isEditMode()">{{ profile()!.price ?? 0 }} MAD</strong>
            <p-inputNumber *ngIf="isEditMode()" formControlName="price" mode="decimal" [useGrouping]="false"></p-inputNumber>
          </div>
          <div class="info-box">
            <span>Portefeuille</span>
            <strong>{{ profile()!.walletBalance ?? 0 }} MAD</strong>
          </div>
          <div class="info-box full-width">
            <span>Bio</span>
            <strong *ngIf="!isEditMode()">{{ profile()!.bio || '-' }}</strong>
            <textarea *ngIf="isEditMode()" pTextarea rows="4" formControlName="bio" class="w-full"></textarea>
          </div>
          <div class="info-box full-width">
            <span>Adresse</span>
            <strong *ngIf="!isEditMode()">{{ profile()!.address || '-' }}</strong>
            <input *ngIf="isEditMode()" pInputText formControlName="address" class="w-full" placeholder="Ex: 12 Rue Hassan II, Casablanca" />
          </div>
        </form>

        <!-- CARTE EN MODE EDIT -->
        <div class="info-box full-width" *ngIf="isEditMode()">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
            <span>📍 Cliquez sur la carte pour choisir votre position</span>
            <button type="button" (click)="useMyLocation()" [disabled]="isLocating()"
              style="background:#1A1A1A; color:#FAFAF7; border:none; padding:8px 16px; border-radius:999px; cursor:pointer; font-size:0.85rem; font-weight:600; font-family:inherit;">
              {{ isLocating() ? '⏳ Localisation...' : '📍 Utiliser ma position' }}
            </button>
          </div>
          <p *ngIf="locationError()" style="color:#e53e3e; font-size:0.82rem; margin:0 0 8px;">
            ⚠️ {{ locationError() }}
          </p>
          <div id="edit-map" style="width:100%; height:350px; border:1px solid rgba(26,26,26,0.15); border-radius:12px;"></div>
        </div>

        <!-- CARTE EN MODE VIEW -->
        <div class="info-box full-width" *ngIf="!isEditMode() && mapUrl()">
          <span>📍 Localisation sur la carte</span>
          <iframe [src]="mapUrl() | safeUrl" width="100%" height="300"
            style="border:1px solid rgba(26,26,26,0.1); border-radius:12px; margin-top:8px" loading="lazy"></iframe>
        </div>

        <div class="profile-actions">
          <button *ngIf="!isEditMode()" pButton type="button" label="Modifier" (click)="startEdit()"></button>
          <ng-container *ngIf="isEditMode()">
            <button pButton type="button" label="Enregistrer" [disabled]="isSaving() || isUploadingPhoto()" (click)="saveProfile()"></button>
            <button pButton type="button" label="Annuler" severity="secondary" [outlined]="true" (click)="cancelEdit()"></button>
          </ng-container>
        </div>

        <!-- ✅ SECTION SERVICES -->
        <div class="services-section">
          <div class="services-header">
            <h3>✂️ Mes services</h3>
            <button pButton type="button" label="➕ Ajouter un service"
              severity="secondary" [outlined]="true"
              (click)="showAddService.set(!showAddService())">
            </button>
          </div>

          <div class="service-form" *ngIf="showAddService()">
            <div class="service-form-grid">
              <div>
                <label>Nom du service *</label>
                <input pInputText [(ngModel)]="newServiceName" placeholder="Ex: Coupe de cheveux" class="w-full" />
              </div>
              <div>
                <label>Prix (MAD) *</label>
                <input pInputText type="number" [(ngModel)]="newServicePrice" placeholder="Ex: 30" class="w-full" />
              </div>
              <div class="full-width">
                <label>Description (optionnel)</label>
                <input pInputText [(ngModel)]="newServiceDesc" placeholder="Ex: Coupe classique avec finitions" class="w-full" />
              </div>
            </div>
            <div class="service-form-actions">
              <button pButton type="button"
                [label]="editingServiceId() ? 'Modifier' : 'Ajouter'"
                [disabled]="!newServiceName || !newServicePrice"
                (click)="saveService()">
              </button>
              <button pButton type="button" label="Annuler"
                severity="secondary" [outlined]="true"
                (click)="cancelServiceForm()">
              </button>
            </div>
          </div>

          <div class="services-list" *ngIf="barberServices().length > 0">
            <div class="service-row" *ngFor="let service of barberServices()">
              <div class="service-row-info">
                <span class="service-row-name">{{ service.name }}</span>
                <span *ngIf="service.description" class="service-row-desc">{{ service.description }}</span>
              </div>
              <div class="service-row-right">
                <span class="service-row-price">{{ service.price }} MAD</span>
                <button (click)="editService(service)"
                  style="background:none; border:none; cursor:pointer; font-size:1rem; padding:4px;">✏️</button>
                <button (click)="deleteService(service.id)"
                  style="background:none; border:none; cursor:pointer; font-size:1rem; padding:4px;">🗑️</button>
              </div>
            </div>
          </div>

          <p *ngIf="barberServices().length === 0"
            style="color:#a3a3a3; text-align:center; padding:1.5rem; font-size:0.9rem;">
            Aucun service ajouté. Cliquez sur "Ajouter un service" !
          </p>
        </div>

        <!-- ✅ SECTION SERVICE À DOMICILE -->
        <div class="home-service-section">
          <div class="home-service-header">
            <div>
              <h3>🏠 Service à domicile</h3>
              <p>Proposez vos services directement chez vos clients</p>
            </div>
            <div *ngIf="homeServiceRequest()">
              <span class="status-badge"
                [class.pending]="homeServiceRequest()!.status === 'PENDING'"
                [class.approved]="homeServiceRequest()!.status === 'APPROVED'"
                [class.rejected]="homeServiceRequest()!.status === 'REJECTED'">
                {{ homeServiceRequest()!.status === 'PENDING' ? '⏳ En attente' :
                   homeServiceRequest()!.status === 'APPROVED' ? '✅ Activé' : '❌ Refusé' }}
              </span>
            </div>
          </div>

          <!-- APPROUVÉ -->
          <div *ngIf="homeServiceRequest()?.status === 'APPROVED'"
            style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:1rem; color:#16a34a; font-weight:600;">
            🏠 Service à domicile activé ! Vos clients peuvent vous demander de vous déplacer.
          </div>

          <!-- REFUSÉ -->
          <div *ngIf="homeServiceRequest()?.status === 'REJECTED'"
            style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:1rem; margin-bottom:1rem;">
            <p style="color:#dc2626; font-weight:600; margin:0 0 4px;">❌ Demande refusée</p>
            <p style="color:#737373; margin:0; font-size:0.88rem;">{{ homeServiceRequest()!.rejectionReason }}</p>
          </div>

          <!-- FORMULAIRE -->
          <div *ngIf="!homeServiceRequest() || homeServiceRequest()?.status === 'REJECTED'"
            class="home-service-form">
            <p style="color:#737373; font-size:0.88rem; margin-bottom:1rem;">
              Pour activer ce service, veuillez soumettre les documents suivants :
            </p>

            <!-- ✅ Diplôme -->
            <div class="doc-upload-item">
              <div class="doc-info">
                <span class="doc-icon">📄</span>
                <div>
                  <strong>Diplôme de coiffure</strong>
                  <p>Photo ou scan de votre diplôme</p>
                </div>
              </div>
              <div class="doc-actions">
                <span *ngIf="isUploadingDoc()" style="color:#737373; font-size:0.82rem;">⏳ Upload...</span>
                <label *ngIf="!isUploadingDoc()" for="diplomaInput" class="upload-label"
                  [style.background]="diplomaUrl() ? '#16a34a' : '#171717'">
                  {{ diplomaUrl() ? '✅ Confirmé' : '📤 Uploader' }}
                </label>
                <input id="diplomaInput" type="file" accept="image/*,.pdf" style="display:none"
                  (change)="onDocumentSelected($event, 'diploma')" />
              </div>
            </div>
            <!-- Aperçu diplôme -->
            <div *ngIf="diplomaUrl()" class="doc-preview">
              <img [src]="diplomaUrl()" alt="Diplôme" />
              <span style="color:#16a34a; font-size:0.78rem; font-weight:600;">✅ Diplôme uploadé avec succès</span>
            </div>

            <!-- ✅ CIN -->
            <div class="doc-upload-item">
              <div class="doc-info">
                <span class="doc-icon">🪪</span>
                <div>
                  <strong>Carte Nationale d'Identité</strong>
                  <p>Recto et verso de votre CIN</p>
                </div>
              </div>
              <div class="doc-actions">
                <span *ngIf="isUploadingDoc()" style="color:#737373; font-size:0.82rem;">⏳ Upload...</span>
                <label *ngIf="!isUploadingDoc()" for="cinInput" class="upload-label"
                  [style.background]="cinUrl() ? '#16a34a' : '#171717'">
                  {{ cinUrl() ? '✅ Confirmé' : '📤 Uploader' }}
                </label>
                <input id="cinInput" type="file" accept="image/*" style="display:none"
                  (change)="onDocumentSelected($event, 'cin')" />
              </div>
            </div>
            <!-- Aperçu CIN -->
            <div *ngIf="cinUrl()" class="doc-preview">
              <img [src]="cinUrl()" alt="CIN" />
              <span style="color:#16a34a; font-size:0.78rem; font-weight:600;">✅ CIN uploadé avec succès</span>
            </div>

            <!-- ✅ Selfie caméra frontale -->
            <div class="doc-upload-item">
              <div class="doc-info">
                <span class="doc-icon">🤳</span>
                <div>
                  <strong>Selfie en temps réel</strong>
                  <p>Photo prise maintenant avec caméra frontale</p>
                </div>
              </div>
              <div class="doc-actions">
                <span *ngIf="isUploadingDoc()" style="color:#737373; font-size:0.82rem;">⏳ Upload...</span>
                <label *ngIf="!isUploadingDoc()" for="selfieInput" class="upload-label"
                  [style.background]="selfieUrl() ? '#16a34a' : '#171717'">
                  {{ selfieUrl() ? '✅ Confirmé' : '📷 Prendre selfie' }}
                </label>
                <input id="selfieInput" type="file" accept="image/*"
                  capture="user" style="display:none"
                  (change)="onDocumentSelected($event, 'selfie')" />
              </div>
            </div>
            <!-- Aperçu selfie -->
            <div *ngIf="selfieUrl()" class="doc-preview">
              <img [src]="selfieUrl()" alt="Selfie" />
              <span style="color:#16a34a; font-size:0.78rem; font-weight:600;">✅ Selfie pris avec succès</span>
            </div>

            <!-- Barre de progression -->
            <div class="upload-progress" *ngIf="diplomaUrl() || cinUrl() || selfieUrl()">
              <div class="progress-step" [class.done]="diplomaUrl()">
                {{ diplomaUrl() ? '✅' : '⬜' }} Diplôme
              </div>
              <div class="progress-step" [class.done]="cinUrl()">
                {{ cinUrl() ? '✅' : '⬜' }} CIN
              </div>
              <div class="progress-step" [class.done]="selfieUrl()">
                {{ selfieUrl() ? '✅' : '⬜' }} Selfie
              </div>
            </div>

            <button pButton type="button"
              label="📤 Soumettre ma demande"
              [disabled]="!diplomaUrl() || !cinUrl() || !selfieUrl() || isUploadingDoc() || isSubmittingHomeService()"
              (click)="submitHomeService()"
              style="margin-top:1rem; width:100%;">
            </button>
          </div>

          <!-- EN ATTENTE -->
          <div *ngIf="homeServiceRequest()?.status === 'PENDING'"
            style="background:#fefce8; border:1px solid #fde047; border-radius:12px; padding:1rem; color:#854d0e;">
            ⏳ Votre demande est en cours de vérification. Nous vous répondrons dans les 24-48h.
          </div>
        </div>

        <!-- PHOTOS -->
        <div class="gallery-section">
          <h3>📸 Photos</h3>
          <div class="gallery-upload">
            <input type="text" placeholder="Description (optionnel)"
              [value]="newCaption()"
              (input)="newCaption.set($any($event.target).value)"
              style="padding:8px; border:1px solid rgba(26,26,26,0.1); border-radius:8px; width:100%; margin-bottom:8px; background:#FAFAF7; box-sizing:border-box;" />
            <label for="galleryInput" style="cursor:pointer; background:#1A1A1A; color:#FAFAF7; padding:8px 16px; border-radius:999px; font-size:0.9rem; display:inline-block;">
              📷 Ajouter une photo
            </label>
            <input id="galleryInput" type="file" accept="image/*" style="display:none" (change)="onGalleryPhotoSelected($event, 'gallery')" />
            <span *ngIf="isUploadingGallery()" style="color:#64748b; font-size:0.85rem; margin-left:8px;">Envoi en cours...</span>
          </div>
          <div class="gallery-grid" *ngIf="photos().length > 0">
            <div class="gallery-item" *ngFor="let photo of photos()">
              <img [src]="photo.imageUrl" [alt]="photo.caption || 'Photo'" />
              <div class="gallery-overlay">
                <span *ngIf="photo.caption">{{ photo.caption }}</span>
                <button (click)="deletePhoto(photo.id)"
                  style="background:rgba(239,68,68,0.9); color:white; border:none; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem;">
                  🗑️
                </button>
              </div>
            </div>
          </div>
          <p *ngIf="photos().length === 0" style="color:rgba(26,26,26,0.4); text-align:center; padding:1rem;">
            Aucune photo. Ajoutez des photos de votre salon !
          </p>
        </div>

      </div>
    </p-card>
  </div>
</section>