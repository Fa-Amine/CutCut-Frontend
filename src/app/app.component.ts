import { Component, signal, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'barber-web-app';
  isDarkMode = signal(false);

  constructor() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') {
      this.isDarkMode.set(true);
      document.body.classList.add('dark-mode');
    }

    effect(() => {
      if (this.isDarkMode()) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'true');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'false');
      }
    });
  }

  toggleDarkMode() {
    this.isDarkMode.update(v => !v);
  }
}