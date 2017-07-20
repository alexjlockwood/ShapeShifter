import { ComponentFixture, TestBed, async, inject } from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import { ActionModeService, LayerTimelineService } from 'app/services';
import { Store } from 'app/store';
import { MockStore } from 'test/MockStore';

import { TimelineAnimationRowComponent } from './timelineanimationrow.component';

describe('TimelineAnimationRowComponent', () => {
  let component: TimelineAnimationRowComponent;
  let fixture: ComponentFixture<TimelineAnimationRowComponent>;

  beforeEach(
    async(() => {
      TestBed.configureTestingModule({
        declarations: [TimelineAnimationRowComponent],
        imports: [FlexLayoutModule],
        providers: [
          { provide: Store, useValue: new MockStore() },
          ActionModeService,
          LayerTimelineService,
        ],
      }).compileComponents();
    }),
  );

  beforeEach(
    inject([Store], (store: MockStore) => {
      fixture = TestBed.createComponent(TimelineAnimationRowComponent);
      component = fixture.componentInstance;
      component.layer = store.getState().present.layers.vectorLayer;
      component.ngOnInit();
      fixture.detectChanges();
    }),
  );

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
