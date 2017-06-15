import {
  Action,
  ActionReducer,
  Store,
} from '@ngrx/store';
import { State } from 'app/store';
import { buildInitialState as buildInitialActionModeState } from 'app/store/actionmode/reducer';
import { buildInitialState as buildInitialLayerState } from 'app/store/layers/reducer';
import { buildInitialState as buildInitialPlaybackState } from 'app/store/playback/reducer';
import { buildInitialState as buildInitialResetState } from 'app/store/reset/reducer';
import { buildInitialState as buildInitialTimelineState } from 'app/store/timeline/reducer';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { map } from 'rxjs/operator/map';

export class MockStore extends Store<State> {

  // TODO: figure out the correct way to initialize this...
  private fakeState: State = {
    timestamp: undefined,
    past: undefined,
    present: {
      actionmode: buildInitialActionModeState(),
      playback: buildInitialPlaybackState(),
      layers: buildInitialLayerState(),
      timeline: buildInitialTimelineState(),
      reset: buildInitialResetState(),
    },
    future: undefined,
    _latestUnfiltered: undefined,
    group: undefined,
  };
  private readonly fakeStateSubject: BehaviorSubject<State> = new BehaviorSubject(this.fakeState);

  readonly select = <T, R>(mapFn: any, ...paths: string[]): Observable<R> => {
    return map.call(this.fakeStateSubject, mapFn);
  };

  constructor() {
    super(
      undefined as Observer<Action>,
      undefined as Observer<ActionReducer<any>>,
      undefined as Observable<any>,
    );
  }

  setState(state: State) {
    this.fakeStateSubject.next(state);
  }

  getState() {
    return this.fakeStateSubject.getValue();
  }
}
