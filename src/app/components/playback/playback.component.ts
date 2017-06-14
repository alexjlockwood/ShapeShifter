import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
} from '@angular/core';
import { AnimatorService } from 'app/services/animator/animator.service';
import {
  State,
  Store,
} from 'app/store';
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
    private readonly animatorService: AnimatorService,
  ) { }

  ngOnInit() {
    this.playbackModel$ = this.store.select(getPlaybackState);
  }

  isSlowMotionClick(event: MouseEvent) {
    event.stopPropagation();
    this.animatorService.toggleIsSlowMotion();
  }

  playPauseButtonClick(event: MouseEvent) {
    event.stopPropagation();
    this.animatorService.toggleIsPlaying();
  }

  rewindClick(event: MouseEvent) {
    event.stopPropagation();
    this.animatorService.rewind();
  }

  fastForwardClick(event: MouseEvent) {
    event.stopPropagation();
    this.animatorService.fastForward();
  }

  isRepeatingClick(event: MouseEvent) {
    event.stopPropagation();
    this.animatorService.toggleIsRepeating();
  }
}

interface PlaybackModel {
  readonly isSlowMotion: boolean;
  readonly isPlaying: boolean;
  readonly isRepeating: boolean;
}
