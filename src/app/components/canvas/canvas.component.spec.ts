import 'rxjs/add/observable/of';

import { ComponentFixture, TestBed, async, inject } from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import { ActionSource } from 'app/model/actionmode';
import {
  ActionModeService,
  AnimatorService,
  LayerTimelineService,
  PlaybackService,
  ShortcutService,
  ThemeService,
} from 'app/services';
import { Store } from 'app/store';
import { Observable } from 'rxjs/Observable';
import { MockStore } from 'test/MockStore';

import { CanvasComponent } from './canvas.component';
import { CanvasContainerDirective } from './canvascontainer.directive';
import { CanvasLayersDirective } from './canvaslayers.directive';
import { CanvasOverlayDirective } from './canvasoverlay.directive';
import { CanvasRulerDirective } from './canvasruler.directive';

describe('CanvasComponent', () => {
  let component: CanvasComponent;
  let fixture: ComponentFixture<CanvasComponent>;

  beforeEach(
    async(() => {
      TestBed.configureTestingModule({
        declarations: [
          CanvasComponent,
          CanvasContainerDirective,
          CanvasLayersDirective,
          CanvasOverlayDirective,
          CanvasRulerDirective,
        ],
        imports: [FlexLayoutModule],
        providers: [
          { provide: Store, useValue: new MockStore() },
          ActionModeService,
          AnimatorService,
          LayerTimelineService,
          PlaybackService,
          ShortcutService,
          ThemeService,
        ],
      }).compileComponents();
    }),
  );

  beforeEach(
    inject([Store], (store: MockStore) => {
      fixture = TestBed.createComponent(CanvasComponent);
      component = fixture.componentInstance;
      component.actionSource = ActionSource.Animated;
      component.canvasBounds$ = Observable.of({ w: 1000, h: 1000 });
      fixture.detectChanges();
    }),
  );

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
