import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { LanguageService } from '../../../core/services/language.service';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    InputTextModule, PasswordModule, ButtonModule, CardModule,
    ErrorAlertComponent
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  langService = inject(LanguageService);

  // ✅ Étape 1 = saisie email, Étape 2 = code + nouveau mot de passe
  step = signal<1 | 2>(1);
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  email = '';
  code = '';
  newPassword = '';
  confirmPassword = '';

  requestCode() {
    if (!this.email) {
      this.errorMessage.set('Veuillez entrer votre email.');
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.authService.forgotPassword(this.email).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.successMessage.set(response.message || 'Code envoye !');
        this.step.set(2);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error?.error?.message || 'Aucun compte associe a cet email.');
      }
    });
  }

  resetPassword() {
    if (!this.code || !this.newPassword || !this.confirmPassword) {
      this.errorMessage.set('Veuillez remplir tous les champs.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Les mots de passe ne correspondent pas.');
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.resetPassword(this.email, this.code, this.newPassword).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set('Mot de passe reinitialise ! Redirection vers la connexion...');
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error?.error?.message || 'Code incorrect ou expire.');
      }
    });
  }

  backToStep1() {
    this.step.set(1);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.code = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }
}