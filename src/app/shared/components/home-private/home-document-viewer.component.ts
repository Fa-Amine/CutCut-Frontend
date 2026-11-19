import { Component, DestroyRef, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HomeDocumentType, PrivateHomeService, privateHomeError } from '../../../core/services/private-home-service.service';

@Component({
  selector: 'app-home-document-viewer', standalone: true, imports: [CommonModule],
  template: `
    <div class="document-buttons">
      <button type="button" *ngFor="let document of documents" (click)="open(document.type)" [disabled]="busy">{{ document.label }}</button>
    </div>
    <dialog #viewer (close)="clear()" aria-label="Justificatif privé">
      <button class="close" type="button" (click)="viewer.close()">Fermer</button>
      <h3>{{ label }}</h3>
      <p *ngIf="busy" role="status">Chargement privé…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <img *ngIf="url" [src]="url" [alt]="label" (load)="imageLoaded()" (error)="imageFailed()" />
      <p>Document confidentiel. Ferme cette fenêtre après consultation.</p>
    </dialog>`,
  styles: [`.document-buttons{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}button{padding:10px 14px;min-height:44px;border:1px solid #ccd5df;border-radius:10px;background:#fff;color:#171717;cursor:pointer}button:disabled{opacity:.5}dialog{border:0;border-radius:18px;padding:20px;width:min(850px,94vw);max-height:90dvh;overflow:auto}dialog::backdrop{background:#0009}img{max-width:100%;height:auto;display:block;margin:auto}.close{float:right}p{font-size:12px;line-height:1.6}`],
})
export class HomeDocumentViewerComponent implements OnDestroy {
  @Input({required: true}) requestId!: number;
  @Output() viewed = new EventEmitter<HomeDocumentType>();
  @ViewChild('viewer', {static: true}) viewer!: ElementRef<HTMLDialogElement>;
  private readonly api = inject(PrivateHomeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly documents: {type: HomeDocumentType; label: string}[] = [
    {type:'selfie',label:'Selfie'}, {type:'diploma',label:'Diplôme'},
    {type:'cin-front',label:'CNI recto'}, {type:'cin-back',label:'CNI verso'},
  ];
  busy = false; error = ''; label = ''; url = '';
  private generation = 0;
  open(type: HomeDocumentType): void {
    if (this.busy || !this.api.ready()) return;
    this.clear();
    const generation = this.generation;
    this.busy = true; this.label = this.documents.find(item => item.type === type)!.label;
    this.viewer.nativeElement.showModal();
    this.api.document(this.requestId, type).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {if (this.generation === generation) this.busy = false;}),
    ).subscribe({
      next: blob => {
        if (this.generation !== generation) return;
        if (blob.type !== 'image/jpeg' || !blob.size || blob.size > 5 * 1024 * 1024) {
          this.error = 'Le serveur n’a pas renvoyé une photo JPEG valide.'; return;
        }
        this.url = URL.createObjectURL(blob);
        // Consultation is recorded only once the browser can decode and display the image.
      },
      error: error => {if (this.generation === generation) this.error = error?.status === 404 ? 'Ce document privé est introuvable. Le dossier doit être vérifié.' : privateHomeError(error);},
    });
    this.selectedType = type;
  }
  selectedType: HomeDocumentType = 'selfie';
  imageLoaded(): void { this.viewed.emit(this.selectedType); }
  imageFailed(): void { this.error = 'Cette photo ne peut pas être affichée.'; if (this.url) URL.revokeObjectURL(this.url); this.url = ''; }
  clear(): void {
    this.generation++;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = ''; this.error = ''; this.busy = false;
  }
  ngOnDestroy(): void { this.clear(); }
}
