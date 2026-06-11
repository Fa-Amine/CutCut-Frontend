import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookingCreatePage } from './booking-create.page';

describe('BookingCreatePage', () => {
  let component: BookingCreatePage;
  let fixture: ComponentFixture<BookingCreatePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BookingCreatePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
