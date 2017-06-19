import { PropertyInputComponent } from './propertyinput.component';
import {
  ComponentFixture,
  TestBed,
  async,
  inject,
} from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule } from '@angular/forms';
import {
  MdButtonModule,
  MdIconModule,
  MdInputModule,
  MdMenuModule,
  MdTooltipModule,
} from '@angular/material';
import { SplitterComponent } from 'app/components/splitter/splitter.component';
import {
  ActionModeService,
  AnimatorService,
  PlaybackService,
} from 'app/services';
import { Store } from 'app/store';
import { MockStore } from 'test/MockStore';

describe('PropertyInputComponent', () => {
  let component: PropertyInputComponent;
  let fixture: ComponentFixture<PropertyInputComponent>;

  beforeEach(async(() => {
    TestBed
      .configureTestingModule({
        declarations: [
          PropertyInputComponent,
          SplitterComponent,
        ],
        imports: [
          FlexLayoutModule,
          FormsModule,
          MdButtonModule,
          MdIconModule,
          MdInputModule,
          MdMenuModule,
          MdTooltipModule,
        ],
        providers: [
          { provide: Store, useValue: new MockStore() },
          ActionModeService,
          AnimatorService,
          PlaybackService,
        ],
      })
      .compileComponents();
  }));

  beforeEach(inject([Store], (store: MockStore) => {
    fixture = TestBed.createComponent(PropertyInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
