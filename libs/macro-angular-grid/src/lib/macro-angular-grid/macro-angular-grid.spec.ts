import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MacroAngularGrid } from './macro-angular-grid';

describe('MacroAngularGrid', () => {
  let component: MacroAngularGrid;
  let fixture: ComponentFixture<MacroAngularGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MacroAngularGrid],
    }).compileComponents();

    fixture = TestBed.createComponent(MacroAngularGrid);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
