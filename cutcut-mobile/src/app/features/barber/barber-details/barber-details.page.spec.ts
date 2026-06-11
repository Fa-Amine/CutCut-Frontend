import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarberDetailsPage } from './barber-details.page';

describe('BarberDetailsPage', () => {
  let component: BarberDetailsPage;
  let fixture: ComponentFixture<BarberDetailsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BarberDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
