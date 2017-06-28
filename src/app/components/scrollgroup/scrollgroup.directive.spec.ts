import { Component } from '@angular/core';
import { ComponentFixture, TestBed, async } from '@angular/core/testing';

import { ScrollGroupDirective } from './scrollgroup.directive';

describe('SplitterComponent', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;

  beforeEach(
    async(() => {
      TestBed.configureTestingModule({
        declarations: [TestComponent, ScrollGroupDirective],
      }).compileComponents();
    }),
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});

@Component({
  template: `<div appScrollGroup='test'></div>`,
})
class TestComponent {}
