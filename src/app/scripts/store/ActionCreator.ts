import { ADD_ANIMATION } from './Reducers';
import { Animation } from '../animations';

export function addAnimation(animation: Animation) {
  return { type: ADD_ANIMATION, payload: { animation } };
}
