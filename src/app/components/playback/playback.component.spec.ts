import { PlaybackComponent } from './playback.component';
import {
  ComponentFixture,
  TestBed,
  async,
  inject,
} from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import {
  MdButtonModule,
  MdIconModule,
  MdTooltipModule,
} from '@angular/material';
import { By } from '@angular/platform-browser';
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

  it('Init', () => {
    component.ngOnInit();
    fixture.detectChanges();
    // TODO: test the behavior here...
    const buttons = fixture.debugElement.queryAll(By.css('button')).map(d => d.nativeElement);
    expect(component).toBeTruthy();
  });
});
