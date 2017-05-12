import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import {
  AnimatorService,
  StateService,
  MorphStatus,
} from '../services';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import { Store } from '@ngrx/store';
import {
  State,
  SetIsSlowMotion,
  SetIsPlaying,
  SetIsRepeating,
  getPlaybackSettings,
} from '../store';
import 'rxjs/add/observable/combineLatest';

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
    this.playbackModel$ = this.store.select(getPlaybackSettings);
  }

  isSlowMotionClick() {
    this.animatorService.toggleIsSlowMotion();
  }

  playPauseButtonClick() {
    this.animatorService.toggle();
  }

  rewindClick() {
    this.animatorService.rewind();
  }

  fastForwardClick() {
    this.animatorService.fastForward();
  }

  isRepeatingClick(isRepeating: boolean) {
    this.animatorService.toggleIsRepeating();
  }
}

interface PlaybackModel {
  readonly isSlowMotion: boolean;
  readonly isPlaying: boolean;
  readonly isRepeating: boolean;
}
