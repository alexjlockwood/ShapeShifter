import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { AnimatorService, PlaybackService } from 'app/services';
import { State, Store } from 'app/store';
import { getPlaybackState } from 'app/store/playback/selectors';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-playback',
  templateUrl: './playback.component.html',
  styleUrls: ['./playback.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaybackComponent implements OnInit {
  playbackModel$: Observable<PlaybackModel>;

  constructor(
    private readonly store: Store<State>,
    private readonly playbackService: PlaybackService,
    private readonly animatorService: AnimatorService,
  ) {}

  ngOnInit() {
    this.playbackModel$ = this.store.select(getPlaybackState);
  }

  isSlowMotionClick(event: MouseEvent) {
    event.stopPropagation();
    this.playbackService.toggleIsSlowMotion();
  }

  rewindClick(event: MouseEvent) {
    event.stopPropagation();
    this.animatorService.rewind();
  }

  playPauseButtonClick(event: MouseEvent) {
    event.stopPropagation();
    this.playbackService.toggleIsPlaying();
  }

  fastForwardClick(event: MouseEvent) {
    event.stopPropagation();
    this.animatorService.fastForward();
  }

  isRepeatingClick(event: MouseEvent) {
    event.stopPropagation();
    this.playbackService.toggleIsRepeating();
  }
}

interface PlaybackModel {
  readonly isSlowMotion: boolean;
  readonly isPlaying: boolean;
  readonly isRepeating: boolean;
}
