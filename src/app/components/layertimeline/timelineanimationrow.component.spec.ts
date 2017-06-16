import { TimelineAnimationRowComponent } from './timelineanimationrow.component';
import {
  ComponentFixture,
  TestBed,
  async,
  inject,
} from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import { Layer } from 'app/scripts/model/layers';
import { Store } from 'app/store';
import { MockStore } from 'test/store/MockStore.spec';

describe('TimelineAnbimationRowComponent', () => {
  let component: TimelineAnimationRowComponent;
  let fixture: ComponentFixture<TimelineAnimationRowComponent>;

  beforeEach(async(() => {
    TestBed
      .configureTestingModule({
        declarations: [TimelineAnimationRowComponent],
        imports: [FlexLayoutModule],
        providers: [{ provide: Store, useValue: new MockStore() }],
      })
      .compileComponents();
  }));

  beforeEach(inject([Store], (store: MockStore) => {
    fixture = TestBed.createComponent(TimelineAnimationRowComponent);
    component = fixture.componentInstance;
    component.layer = store.getState().present.layers.vectorLayer;
    fixture.detectChanges();
  }));

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
