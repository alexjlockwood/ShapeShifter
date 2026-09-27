import { on } from 'app/modules/editor/scripts/dom';
import { ShortcutService } from 'app/modules/editor/services/shortcut.service';

import { createToolButton } from './EditorToolbar';
import type { BooleanOp } from './pathOps';

export type PathOpName = BooleanOp | 'outline';

/** Whether the boolean operations, and outlining strokes, apply to the selection. */
export interface AvailablePathOps {
  readonly booleans: boolean;
  readonly outline: boolean;
}

export const NO_PATH_OPS: AvailablePathOps = { booleans: false, outline: false };

interface PathOpButton {
  readonly op: PathOpName;
  readonly label: string;
  readonly shortcut: string;
  readonly icon: string;
}

// Figma's shortcuts. Cmd is Ctrl outside of Macs.
const OPS: ReadonlyArray<PathOpButton> = [
  {
    op: 'union',
    label: 'Union',
    shortcut: 'Alt+Shift+U',
    icon: 'M3 3h12v6h6v12H9v-6H3V3z',
  },
  {
    op: 'subtract',
    label: 'Subtract',
    shortcut: 'Alt+Shift+S',
    icon: 'M3 3h12v6H9v6H3V3zm7 7h10v10H10V10zm2 2v6h6v-6h-6z',
  },
  {
    op: 'intersect',
    label: 'Intersect',
    shortcut: 'Alt+Shift+I',
    icon: 'M3 3h12v2H5v10h2v2H3V3zm18 18H9v-2h10V9h-2V7h4v14zM9 9h6v6H9V9z',
  },
  {
    op: 'exclude',
    label: 'Exclude',
    shortcut: 'Alt+Shift+E',
    icon: 'M3 3h12v6H9v6H3V3zm18 18H9v-6h6V9h6v12z',
  },
  {
    op: 'outline',
    label: 'Outline stroke',
    shortcut: 'Command+Alt+O',
    icon: 'M4 9h16v6H4V9zm2 2v2h12v-2H6z',
  },
];

/**
 * Buttons for combining the selected paths and outlining their strokes, at the top right of the
 * canvas panel. They only show when one of them applies to the selection.
 */
export class PathOpsBar {
  private readonly element: HTMLElement;
  private readonly buttons = new Map<PathOpName, HTMLButtonElement>();
  private readonly removeListeners: Array<() => void> = [];

  constructor(root: HTMLElement, onRun: (op: PathOpName) => void) {
    this.element = document.createElement('div');
    this.element.className = 'canvas-editor-pathops';
    this.element.setAttribute('role', 'toolbar');
    this.element.setAttribute('aria-label', 'Path operations');
    this.element.hidden = true;
    for (const { op, label, shortcut, icon } of OPS) {
      const [button, removeListener] = createToolButton(label, shortcut, icon, () => onRun(op));
      this.removeListeners.push(removeListener);
      this.buttons.set(op, button);
      this.element.appendChild(button);
    }
    // Presses and hovers over the bar aren't gestures on the canvas under it.
    this.removeListeners.push(
      on(this.element, 'pointerdown', event => event.stopPropagation()),
      on(this.element, 'pointermove', event => event.stopPropagation()),
    );
    root.appendChild(this.element);
  }

  /** Shows the operations that apply to the selection, or hides the bar if none do. */
  setAvailable({ booleans, outline }: AvailablePathOps) {
    this.element.hidden = !booleans && !outline;
    for (const [op, button] of this.buttons) {
      button.disabled = op === 'outline' ? !outline : !booleans;
    }
  }

  dispose() {
    this.removeListeners.forEach(remove => remove());
    this.element.remove();
  }
}

/**
 * Returns the path operation that the key runs: Alt+Shift+U, S, I, and E for the booleans, and
 * Cmd+Alt+O for outlining strokes, by the keys' positions, since Alt changes what they type.
 */
export function getPathOpShortcut(event: KeyboardEvent): PathOpName | undefined {
  if (!event.altKey) {
    return undefined;
  }
  const isCommand = ShortcutService.isOsDependentModifierKey(event);
  const hasOtherModifier = ShortcutService.isMac() ? event.ctrlKey : event.metaKey;
  if (hasOtherModifier) {
    return undefined;
  }
  if (isCommand) {
    return !event.shiftKey && event.code === 'KeyO' ? 'outline' : undefined;
  }
  if (!event.shiftKey) {
    return undefined;
  }
  const booleans: Readonly<Record<string, BooleanOp>> = {
    KeyU: 'union',
    KeyS: 'subtract',
    KeyI: 'intersect',
    KeyE: 'exclude',
  };
  return booleans[event.code];
}
