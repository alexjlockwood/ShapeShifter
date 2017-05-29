export { Store } from '@ngrx/store';
export { State, reducer } from './reducer';
export {
  AppMode,
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
  UpdatePathBlock,
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
  EnterShapeShifterMode,
  ExitShapeShifterMode,
  SetAppMode,
  SetHover,
  SetSelections,
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
} from './actionmode/actions';
