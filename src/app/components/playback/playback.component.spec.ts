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
import { AnimatorService } from 'app/services/animator/animator.service';
import { PlaybackService } from 'app/services/playback/playback.service';
import { Store } from 'app/store';
import { MockStore } from 'test/MockStore';

describe('PlaybackComponent', () => {
  let component: PlaybackComponent;
  let fixture: ComponentFixture<PlaybackComponent>;

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

  beforeEach(inject([Store], (store: MockStore) => {
    fixture = TestBed.createComponent(PlaybackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
