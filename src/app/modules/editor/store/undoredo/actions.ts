import { Action } from 'app/modules/editor/store';

export enum UndoRedoActionTypes {
  IsolateUndoStep = '__undoredo__ISOLATE_UNDO_STEP',
  SkipUndoStep = '__undoredo__SKIP_UNDO_STEP',
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
 * isolated (see LayerTimelineService.commitPreview). It doesn't change the state.
 */
export class SkipUndoStep implements Action {
  readonly type = UndoRedoActionTypes.SkipUndoStep;
}

export type UndoRedoActions = IsolateUndoStep | SkipUndoStep;
