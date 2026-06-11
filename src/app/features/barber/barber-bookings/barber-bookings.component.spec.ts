import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BarberBookingsComponent } from './barber-bookings.component';

describe('BarberBookingsComponent', () => {
  let component: BarberBookingsComponent;
  let fixture: ComponentFixture<BarberBookingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarberBookingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BarberBookingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
