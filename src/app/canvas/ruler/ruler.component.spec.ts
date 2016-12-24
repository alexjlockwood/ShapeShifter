/* tslint:disable:no-unused-variable */
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import { RulerComponent } from './ruler.component';

describe('RulerComponent', () => {
  let component: RulerComponent;
  let fixture: ComponentFixture<RulerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RulerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RulerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
