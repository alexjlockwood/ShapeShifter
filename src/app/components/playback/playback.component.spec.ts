import { PlaybackComponent } from './playback.component';
import {
  ComponentFixture,
  TestBed,
  async,
  fakeAsync,
  inject,
} from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import {
  MdButtonModule,
  MdIconModule,
  MdTooltipModule,
} from '@angular/material';
import { By } from '@angular/platform-browser';
import { Action } from '@ngrx/store';
import { AnimatorService } from 'app/services/animator/animator.service';
import { PlaybackService } from 'app/services/playback/playback.service';
import { Store } from 'app/store';
import { MockStore } from 'test/MockStore';

describe('PlaybackComponent', () => {
  let component: PlaybackComponent;
  let fixture: ComponentFixture<PlaybackComponent>;
  let store: MockStore;

  beforeEach(async(() => {
    TestBed
      .configureTestingModule({
        declarations: [PlaybackComponent],
        imports: [
          FlexLayoutModule,
          MdButtonModule,
          MdIconModule,
          MdTooltipModule,
        ],
        providers: [
          { provide: Store, useValue: new MockStore() },
          AnimatorService,
          PlaybackService,
        ],
      })
      .compileComponents();
  }));

  beforeEach(inject([Store], (s: MockStore) => {
    fixture = TestBed.createComponent(PlaybackComponent);
    component = fixture.componentInstance;
    store = s;
  }));

  it('No buttons activated', () => {
    store.setPlaybackState({ isSlowMotion: false, isPlaying: false, isRepeating: false });
    component.ngOnInit();
    fixture.detectChanges();
    const buttons = fixture.debugElement.queryAll(By.css('md-icon.activated')).map(d => d.nativeElement);
    expect(buttons.length).toBe(0);
  });

  it('All buttons activated', () => {
    store.setPlaybackState({ isSlowMotion: true, isPlaying: false, isRepeating: true });
    component.ngOnInit();
    fixture.detectChanges();
    const buttons = fixture.debugElement.queryAll(By.css('md-icon.activated')).map(d => d.nativeElement);
    expect(buttons.length).toBe(2);
  });

  it('Button click trigger store dispatch', fakeAsync(() => {
    store.setPlaybackState({ isSlowMotion: true, isPlaying: false, isRepeating: true });
    component.ngOnInit();
    fixture.detectChanges();

    const slowMotionClickEvent = { stopPropagation: () => { } };
    const repeatingClickEvent = { stopPropagation: () => { } };

    spyOn(store, 'dispatch');
    spyOn(slowMotionClickEvent, 'stopPropagation');
    spyOn(repeatingClickEvent, 'stopPropagation');

    const slowMotionButton = fixture.debugElement.query(By.css('button.slow-motion-button'));
    slowMotionButton.triggerEventHandler('click', slowMotionClickEvent);
    const repeatingButton = fixture.debugElement.query(By.css('button.repeating-button'));
    repeatingButton.triggerEventHandler('click', repeatingClickEvent);

    expect(store.dispatch).toHaveBeenCalledTimes(2);
    expect(slowMotionClickEvent.stopPropagation).toHaveBeenCalled();
    expect(repeatingClickEvent.stopPropagation).toHaveBeenCalled();
  }));
});
