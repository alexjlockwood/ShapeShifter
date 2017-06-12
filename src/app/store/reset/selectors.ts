import { getAppState } from '../selectors';
import { AnimationBlock } from 'app/scripts/model/timeline';
import * as _ from 'lodash';
import { createSelector } from 'reselect';

const getResetState = createSelector(getAppState, s => s.reset);
export const isBeingReset = createSelector(getResetState, r => r.isBeingReset);
