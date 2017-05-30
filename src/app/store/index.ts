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
export {
  ActivateAnimation,
  AddAnimations,
  AddBlock,
  AddLayers,
  ClearLayerSelections,
  DeleteSelectedModels,
  ReplaceAnimations,
  ReplaceBlocks,
  ReplaceLayer,
  SelectAnimation,
  SelectBlock,
  SelectLayer,
  ToggleLayerExpansion,
  ToggleLayerVisibility,
} from './aia/actions';

// Playback actions.
export {
  SetIsPlaying,
  SetIsRepeating,
  SetIsSlowMotion,
  ToggleIsPlaying,
  ToggleIsRepeating,
  ToggleIsSlowMotion,
} from './playback/actions';

// Shape Shifter actions.
export {
  SetActivePathBlockId,
  ClearActivePathBlockId,
  SetShapeShifterMode,
  SetPathHover,
  SetPathSelections,
  TogglePointSelection,
  ToggleSegmentSelections,
  ToggleSubPathSelection,
} from './shapeshifter/actions';

// Resetable actions.
export { ResetWorkspace } from './resetable/actions';

// Action mode actions.
export {
  DeleteSelectedPoints,
  DeleteSelectedSegments,
  DeleteSelectedSubPaths,
  ReverseSelectedSubPaths,
  ShiftBackSelectedSubPaths,
  ShiftForwardSelectedSubPaths,
  ShiftPointToFront,
  SplitCommandInHalfClick,
  SplitCommandInHalfHover,
  UpdateActivePathBlock,
} from './actionmode/actions';
