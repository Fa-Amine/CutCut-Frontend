import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarbersListPage } from './barbers-list.page';

describe('BarbersListPage', () => {
  let component: BarbersListPage;
  let fixture: ComponentFixture<BarbersListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BarbersListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
