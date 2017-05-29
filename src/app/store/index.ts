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
  AddAnimations,
  SelectAnimation,
  ActivateAnimation,
  ReplaceAnimations,
  AddBlock,
  SelectBlock,
  ReplaceBlocks,
  UpdatePathBlock,
  ReplaceLayer,
  SelectLayer,
  ClearLayerSelections,
  ToggleLayerExpansion,
  ToggleLayerVisibility,
  AddLayers,
  DeleteSelectedModels,
} from './aia/actions';

// Playback actions.
export {
  SetIsSlowMotion,
  SetIsPlaying,
  SetIsRepeating,
  ToggleIsSlowMotion,
  ToggleIsPlaying,
  ToggleIsRepeating,
  ResetPlaybackSettings,
} from './playback/actions';

// Shape Shifter actions.
export {
  EnterShapeShifterMode,
  ExitShapeShifterMode,
  SetAppMode,
  SetHover,
  SetSelections,
  ToggleSubPathSelection,
  ToggleSegmentSelections,
  TogglePointSelection,
  ReversePoints,
  ShiftBackPoints,
  ShiftForwardPoints,
  DeleteSubPaths,
  DeleteSegments,
  DeletePoints,
  SetFirstPosition,
  SplitInHalfHover,
  SplitInHalfClick,
} from './shapeshifter/actions';

// Resetable actions.
export { ResetWorkspace } from './resetable/actions';
