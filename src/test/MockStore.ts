import { Action, ActionsSubject, ReducerManager, StateObservable, Store } from '@ngrx/store';
import { State, prodReducer } from 'app/store';
import { State as LayerState } from 'app/store/layers/reducer';
import { State as PlaybackState } from 'app/store/playback/reducer';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { map } from 'rxjs/operator/map';

const INIT_ACTION: Action = { type: '__test123__' };

export class MockStore extends Store<State> {
  private readonly subject: BehaviorSubject<State>;

  constructor() {
    super(undefined as StateObservable, undefined as ActionsSubject, undefined as ReducerManager);
    this.subject = new BehaviorSubject(prodReducer(undefined, INIT_ACTION));
  }

  select<T>(mapFn: (state: State) => T): Store<T> {
    return map.call(this.subject, mapFn);
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
