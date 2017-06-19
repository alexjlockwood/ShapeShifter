import {
  Action,
  ActionReducer,
  Store,
} from '@ngrx/store';
import { State, productionReducer } from 'app/store';
import { buildInitialState as buildInitialActionModeState } from 'app/store/actionmode/reducer';
import { buildInitialState as buildInitialLayerState } from 'app/store/layers/reducer';
import {
  State as PlaybackState,
  buildInitialState as buildInitialPlaybackState,
} from 'app/store/playback/reducer';
import { buildInitialState as buildInitialResetState } from 'app/store/reset/reducer';
import { buildInitialState as buildInitialTimelineState } from 'app/store/timeline/reducer';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { map } from 'rxjs/operator/map';

const INIT_ACTION: Action = { type: '__test123__' };

export class MockStore extends Store<State> {

  private readonly subject: BehaviorSubject<State>;

  constructor() {
    super(
      undefined as Observer<Action>,
      undefined as Observer<ActionReducer<any>>,
      undefined as Observable<any>,
    );
    this.subject = new BehaviorSubject(productionReducer(undefined, INIT_ACTION));
  }

  readonly select = <T, R>(mapFn: any, ...paths: string[]): Observable<R> => {
    return map.call(this.subject, mapFn);
  }

  dispatch(action: Action) { }

  setPlaybackState(playback: PlaybackState) {
    const state = this.getState();
    const { present } = state;
    this.subject.next({ ...state, present: { ...present, playback } });
  }

  getState() {
    return this.subject.getValue();
  }
}
