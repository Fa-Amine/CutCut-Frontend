import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BarberDetailsComponent } from './barber-details.component';

describe('BarberDetailsComponent', () => {
  let component: BarberDetailsComponent;
  let fixture: ComponentFixture<BarberDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarberDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BarberDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
