import { State } from './reducer';
import * as _ from 'lodash';
import { createSelectorCreator, defaultMemoize } from 'reselect';

export const getState = (state: State) => state;
export const createDeepEqualSelector = createSelectorCreator(defaultMemoize, _.isEqual);
