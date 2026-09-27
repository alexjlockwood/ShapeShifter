import type { Guide } from 'app/modules/editor/model/guides';
import { State, Store } from 'app/modules/editor/store';
import { BatchAction } from 'app/modules/editor/store/batch/actions';
import { SetGuides } from 'app/modules/editor/store/guides/actions';
import { getGuides } from 'app/modules/editor/store/guides/selectors';
import { IsolateUndoStep } from 'app/modules/editor/store/undoredo/actions';

/** Changes the canvas editor's guides (model/guides). */
export class GuideService {
  constructor(private readonly store: Store<State>) {}

  getGuides() {
    return getGuides(this.store.getState());
  }

  /** Replaces the guides, as an undo step of its own, like the canvas editor's other gestures. */
  setGuides(guides: ReadonlyArray<Guide>) {
    this.store.dispatch(new BatchAction(new IsolateUndoStep(), new SetGuides(guides)));
  }
}
