import { SelectAnimation } from './actions';
import { buildInitialState, reducer } from './reducer';

describe('@ngrx/store timeline', () => {
  it('should select/deselect the animation', () => {
    let state = reducer(undefined, new SelectAnimation(true));
    expect(state.isAnimationSelected).toEqual(true);
    state = reducer(state, new SelectAnimation(false));
    expect(state.isAnimationSelected).toEqual(false);
  });
});
