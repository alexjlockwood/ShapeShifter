import { ToolMode } from 'app/model/paper';
import { State, Store } from 'app/store';
import * as paper from 'paper';

/**
 * Represents the base class for all tool modes.
 */
export abstract class Tool {
  // TODO: do something with the store
  constructor(private readonly store: Store<State>) {}

  onActivate() {}
  onToolModeChanged(toolMode: ToolMode) {}
  onMouseEvent(event: paper.ToolEvent) {}
  onKeyEvent(event: paper.KeyEvent) {}
  onDeactivate() {}
}
