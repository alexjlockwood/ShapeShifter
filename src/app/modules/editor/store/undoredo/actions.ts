import { Action } from 'app/modules/editor/store';

export enum UndoRedoActionTypes {
  IsolateUndoStep = '__undoredo__ISOLATE_UNDO_STEP',
  SkipUndoStep = '__undoredo__SKIP_UNDO_STEP',
  EndPreview = '__undoredo__END_PREVIEW',
}

/**
 * Gives the batch it's in an undo step of its own, even if it comes right after another edit (see
 * metareducer.ts). A gesture on the canvas is one thing to undo. It doesn't change the state.
 */
export class IsolateUndoStep implements Action {
  readonly type = UndoRedoActionTypes.IsolateUndoStep;
}

/**
 * Keeps the batch it's in out of the undo history, e.g. to preview a value while it's dragged.
 * Undo still goes back to the state before the previews, and the edit that saves them should be
 * isolated (see LayerTimelineService.commitPreview). Until then, a preview is pending (see
 * isPreviewPending in metareducer.ts). It doesn't change the state.
 */
export class SkipUndoStep implements Action {
  readonly type = UndoRedoActionTypes.SkipUndoStep;
}

/**
 * Keeps the batch it's in out of the undo history, like SkipUndoStep, and ends the pending
 * preview, e.g. to show the recorded values again (see LayerTimelineService.cancelPreview). It
 * doesn't change the state.
 */
export class EndPreview implements Action {
  readonly type = UndoRedoActionTypes.EndPreview;
}

export type UndoRedoActions = IsolateUndoStep | SkipUndoStep | EndPreview;
