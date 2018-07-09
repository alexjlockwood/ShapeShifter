import { State, prodReducer } from 'app/store';
import { Action, ActionReducer, Store } from 'app/store';
import { State as LayerState } from 'app/store/layers/reducer';
import { State as PlaybackState } from 'app/store/playback/reducer';
import { BehaviorSubject, Observable, Observer } from 'rxjs';
import { map } from 'rxjs/operators';

const INIT_ACTION: Action = { type: '__test123__' };

export class MockStore extends Store<State> {
  private readonly subject: BehaviorSubject<State>;

  constructor() {
    super(
      undefined as Observer<Action>,
      undefined as Observer<ActionReducer<any>>,
      undefined as Observable<any>,
    );
    this.subject = new BehaviorSubject(prodReducer(undefined, INIT_ACTION));
  }

  select<R>(mapFn: (state: State) => R) {
    return this.subject.pipe(map(mapFn));
  }

  dispatch(action: Action) {}

  getState() {
    return this.subject.getValue();
  }

  setLayerState(layers: LayerState) {
    const state = this.getState();
    const newState: State = { ...state, present: { ...state.present, layers } };
    this.subject.next(newState);
  }

  setPlaybackState(playback: PlaybackState) {
    const state = this.getState();
    const newState: State = { ...state, present: { ...state.present, playback } };
    this.subject.next(newState);
  }
}
