export { Store } from '@ngrx/store';
export { State, reducer } from './reducer';
export {
  ShapeShifterMode,
  Hover,
  HoverType,
  Selection,
  SelectionType,
} from './shapeshifter';

// Android Icon Animator actions.
export { DeleteSelectedModels } from './aia/actions';

// Timeline actions.
export {
  ActivateAnimation,
  AddAnimations,
  ReplaceAnimations,
  SelectAnimation,
  AddBlock,
  ReplaceBlocks,
  SelectBlock,
} from './timeline/actions';

// Layer actions.
export {
  AddLayers,
  ClearLayerSelections,
  ReplaceLayer,
  ToggleLayerExpansion,
  ToggleLayerVisibility,
  SelectLayer,
} from './layers/actions';

// Playback actions.
export {
  SetIsPlaying,
  ToggleIsPlaying,
  ToggleIsRepeating,
  ToggleIsSlowMotion,
} from './playback/actions';

// Shape Shifter actions.
export {
  SetActivePathBlockId,
  ClearActivePathBlockId,
  SetShapeShifterMode,
  ToggleShapeShifterMode,
  SetShapeShifterHover,
  SetShapeShifterSelections,
  TogglePointSelection,
  ToggleSegmentSelections,
  ToggleSubPathSelection,
} from './shapeshifter/actions';

// Resetable actions.
export { ResetWorkspace } from './reset/actions';

// Action mode actions.
export {
  DeleteSelectedPoints,
  DeleteSelectedSegments,
  DeleteSelectedSubPaths,
  ReverseSelectedSubPaths,
  PairSubPath,
  SetUnpairedSubPath,
  ShiftBackSelectedSubPaths,
  ShiftForwardSelectedSubPaths,
  ShiftPointToFront,
  SplitCommandInHalfClick,
  SplitCommandInHalfHover,
  UpdateActivePathBlock,
} from './actionmode/actions';
