import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { LanguageService } from '../../../core/services/language.service';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';

type RegisterRole = 'CLIENT' | 'BARBER';

interface PredefinedService {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  selected: boolean;
}

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (!password || !confirmPassword) return null;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    InputTextModule, PasswordModule, ButtonModule, CardModule,
    SelectButtonModule, InputNumberModule, TextareaModule,
    ErrorAlertComponent
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  langService = inject(LanguageService);

  selectedRole = signal<RegisterRole>('CLIENT');
  isLoading = signal(false);
  errorMessage = signal('');
  fromBarberButton = signal(false);

  // ✅ Ajout de l'option BOTH (Les deux)
  selectedCategory = signal<'HOMME' | 'FEMME' | 'BOTH'>('HOMME');

  predefinedServices = signal<PredefinedService[]>([
    {
      id: 'coupe',
      name: 'Coupe de cheveux',
      nameAr: 'قصة شعر',
      icon: '/images/services/service-coupe.png',
      selected: false
    },
    {
      id: 'barbe',
      name: 'Barbe',
      nameAr: 'حلاقة اللحية',
      icon: '/images/services/service-barbe.png',
      selected: false
    },
    {
      id: 'brushing',
      name: 'Brushing',
      nameAr: 'مكواة الشعر',
      icon: '/images/services/service-brushing.png',
      selected: false
    },
    {
      id: 'keratine',
      name: 'Keratine / Proteine',
      nameAr: 'كيراتين / بروتين',
      icon: '/images/services/service-keratine.png',
      selected: false
    },
    {
      id: 'soin',
      name: 'Soin du visage',
      nameAr: 'عناية بالوجه',
      icon: '🧖',
      selected: false
    }
  ]);

  // ✅ Prix stockés séparément (objet normal, pas signal) pour éviter le reset curseur
  servicePrices: Record<string, number | null> = {};

  customServices = signal<{ name: string; price: number | null }[]>([]);
  showAddCustomService = signal(false);
  newCustomServiceName = '';
  newCustomServicePrice: number | null = null;

  registerForm = this.fb.group(
    {
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      password: ['', [Validators.required]],
      confirmPassword: ['', [Validators.required]],
      shopName: [''],
      bio: [''],
      photoUrl: [''],
      price: [null as number | null]
    },
    { validators: passwordMatchValidator }
  );

  translatedRoleOptions = computed(() => [
    { label: this.langService.t().client, value: 'CLIENT' as RegisterRole },
    { label: this.langService.t().barber, value: 'BARBER' as RegisterRole }
  ]);

  ngOnInit() {
    const role = this.route.snapshot.queryParamMap.get('role');
    if (role === 'barber') {
      this.selectedRole.set('BARBER');
      this.fromBarberButton.set(true);
      this.applyRoleValidators('BARBER');
    } else {
      this.applyRoleValidators('CLIENT');
    }
  }

  setRole(role: RegisterRole) {
    this.selectedRole.set(role);
    this.applyRoleValidators(role);
  }

  // ✅ Accepte HOMME / FEMME / BOTH
  setCategory(category: 'HOMME' | 'FEMME' | 'BOTH') {
    this.selectedCategory.set(category);
  }

  toggleService(serviceId: string) {
    this.predefinedServices.update((services: PredefinedService[]) =>
      services.map((s: PredefinedService) =>
        s.id === serviceId ? { ...s, selected: !s.selected } : s
      )
    );
  }

  addCustomService() {
    if (!this.newCustomServiceName) return;
    this.customServices.update(services => [
      ...services,
      { name: this.newCustomServiceName, price: this.newCustomServicePrice }
    ]);
    this.newCustomServiceName = '';
    this.newCustomServicePrice = null;
    this.showAddCustomService.set(false);
  }

  removeCustomService(index: number) {
    this.customServices.update(services => services.filter((_, i) => i !== index));
  }

  isImagePath(icon: string): boolean {
    return icon.startsWith('/');
  }

  private applyRoleValidators(role: RegisterRole) {
    const shopName = this.registerForm.get('shopName');
    const price = this.registerForm.get('price');
    const bio = this.registerForm.get('bio');
    const photoUrl = this.registerForm.get('photoUrl');

    if (role === 'BARBER') {
      shopName?.setValidators([Validators.required]);
      bio?.clearValidators();
      photoUrl?.clearValidators();
      price?.clearValidators();
      price?.setValue(null);
    } else {
      shopName?.clearValidators();
      bio?.clearValidators();
      photoUrl?.clearValidators();
      price?.clearValidators();
      shopName?.setValue('');
      bio?.setValue('');
      photoUrl?.setValue('');
      price?.setValue(null);
    }

    shopName?.updateValueAndValidity();
    bio?.updateValueAndValidity();
    photoUrl?.updateValueAndValidity();
    price?.updateValueAndValidity();
  }

  get nameControl() { return this.registerForm.get('name'); }
  get emailControl() { return this.registerForm.get('email'); }
  get phoneControl() { return this.registerForm.get('phone'); }
  get passwordControl() { return this.registerForm.get('password'); }
  get confirmPasswordControl() { return this.registerForm.get('confirmPassword'); }
  get shopNameControl() { return this.registerForm.get('shopName'); }
  get bioControl() { return this.registerForm.get('bio'); }
  get priceControl() { return this.registerForm.get('price'); }

  get passwordMismatch() {
    return this.registerForm.hasError('passwordMismatch') &&
      this.confirmPasswordControl?.touched;
  }

  get currentSubtitle() {
    return this.selectedRole() === 'CLIENT'
      ? this.langService.t().clientRegisterSubtitle
      : this.langService.t().barberRegisterSubtitle;
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const formValue = this.registerForm.getRawValue();

    if (this.selectedRole() === 'BARBER') {
      const selectedPredefined = this.predefinedServices()
        .filter((s: PredefinedService) => s.selected && this.servicePrices[s.id])
        .map((s: PredefinedService) => ({
          name: s.name,
          price: this.servicePrices[s.id]!,
          description: ''
        }));

      const customServicesFormatted = this.customServices()
        .filter(s => s.name && s.price)
        .map(s => ({
          name: s.name,
          price: s.price!,
          description: ''
        }));

      const allServices = [...selectedPredefined, ...customServicesFormatted];
      const globalPrice = allServices.length > 0 ? allServices[0].price : 0;

      this.authService.registerBarber({
        name: formValue.name!,
        email: formValue.email!,
        phone: formValue.phone!,
        password: formValue.password!,
        shopName: formValue.shopName!,
        bio: formValue.bio || '',
        photoUrl: formValue.photoUrl || '',
        price: globalPrice,
        category: this.selectedCategory(),
        services: allServices
      }).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/barber/dashboard']);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.errorMessage.set(error?.error?.message || 'Inscription barbier impossible.');
        }
      });
      return;
    }

    this.authService.registerClient({
      name: formValue.name!,
      email: formValue.email!,
      phone: formValue.phone!,
      password: formValue.password!
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error?.error?.message || 'Inscription client impossible.');
      }
    });
  }
}