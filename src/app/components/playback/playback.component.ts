import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { PlaybackService } from 'app/services';
import { State, Store } from 'app/store';
import { getPlaybackState } from 'app/store/playback/selectors';
import { Observable } from 'rxjs';

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
    this.playbackService.rewind();
  }

  playPauseButtonClick(event: MouseEvent) {
    event.stopPropagation();
    this.playbackService.toggleIsPlaying();
  }

  fastForwardClick(event: MouseEvent) {
    event.stopPropagation();
    this.playbackService.fastForward();
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
