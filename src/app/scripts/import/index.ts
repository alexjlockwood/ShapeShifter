import * as SvgLoader from './SvgLoader';
import * as VectorDrawableLoader from './VectorDrawableLoader';
export { SvgLoader, VectorDrawableLoader };

// This ID is reserved for the active path layer's parent group layer
// (i.e. if the user adds a rotation to the path morphing animation).
export const ROTATION_GROUP_LAYER_ID = 'rotation_group';
