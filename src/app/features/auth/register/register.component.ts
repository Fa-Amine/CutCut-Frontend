import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CardModule,
    SelectButtonModule,
    InputNumberModule,
    TextareaModule,
    ErrorAlertComponent
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  langService = inject(LanguageService);

  selectedRole = signal<RegisterRole>('CLIENT');
  isLoading = signal(false);
  errorMessage = signal('');

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

  constructor() {
    this.applyRoleValidators(this.selectedRole());
  }

  setRole(role: RegisterRole) {
    this.selectedRole.set(role);
    this.applyRoleValidators(role);
  }

  private applyRoleValidators(role: RegisterRole) {
    const shopName = this.registerForm.get('shopName');
    const bio = this.registerForm.get('bio');
    const photoUrl = this.registerForm.get('photoUrl');
    const price = this.registerForm.get('price');

    if (role === 'BARBER') {
      shopName?.setValidators([Validators.required]);
      price?.setValidators([Validators.required, Validators.min(0)]);
      bio?.clearValidators();
      photoUrl?.clearValidators();
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

  get nameControl() {
    return this.registerForm.get('name');
  }

  get emailControl() {
    return this.registerForm.get('email');
  }

  get phoneControl() {
    return this.registerForm.get('phone');
  }

  get passwordControl() {
    return this.registerForm.get('password');
  }

  get confirmPasswordControl() {
    return this.registerForm.get('confirmPassword');
  }

  get shopNameControl() {
    return this.registerForm.get('shopName');
  }

  get bioControl() {
    return this.registerForm.get('bio');
  }

  get priceControl() {
    return this.registerForm.get('price');
  }

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
      console.log('Register form invalid:', this.registerForm.getRawValue(), this.registerForm.errors);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const formValue = this.registerForm.getRawValue();

    if (this.selectedRole() === 'BARBER') {
      this.authService.registerBarber({
        name: formValue.name!,
        email: formValue.email!,
        phone: formValue.phone!,
        password: formValue.password!,
        shopName: formValue.shopName!,
        bio: formValue.bio || '',
        photoUrl: formValue.photoUrl || '',
        price: Number(formValue.price)
      }).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/barber/dashboard']);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            error?.error?.message || 'Inscription barbier impossible.'
          );
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
        this.errorMessage.set(
          error?.error?.message || 'Inscription client impossible.'
        );
      }
    });
  }
}