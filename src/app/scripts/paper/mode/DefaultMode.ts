import * as paper from 'paper';

import { Mode } from './Mode';

export class DefaultMode extends Mode {
  onActivate() {}
  onMouseEvent(event: paper.ToolEvent) {}
  onKeyEvent(event: paper.KeyEvent) {}
  onDeactivate() {}
}
