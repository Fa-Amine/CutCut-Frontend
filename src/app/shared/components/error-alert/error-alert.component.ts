import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-alert.component.html',
  styleUrl: './error-alert.component.css'
})
export class ErrorAlertComponent implements OnInit {
  @Input() title = 'Une erreur est survenue';
  @Input() message = 'Une erreur est survenue.';
  @Input() technical = '';

  ngOnInit() {
    if (this.technical) {
      console.error('[CutCut Error]', this.technical);
    }
  }

  reload() {
    window.location.reload();
  }
}