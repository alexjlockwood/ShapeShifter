import { MathUtil } from 'app/scripts/common';
import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that adds a single segment to a location along a curve.
 * This gesture is only used during edit path mode.
 */
export class AddSegmentToCurveGesture extends Gesture {}
