import { Action } from 'app/modules/editor/store';

export enum UndoRedoActionTypes {
  IsolateUndoStep = '__undoredo__ISOLATE_UNDO_STEP',
}

/**
 * Gives the batch it's in an undo step of its own, even if it comes right after another edit (see
 * metareducer.ts). A gesture on the canvas is one thing to undo. It doesn't change the state.
 */
export class IsolateUndoStep implements Action {
  readonly type = UndoRedoActionTypes.IsolateUndoStep;
}

export type UndoRedoActions = IsolateUndoStep;
