import { on } from 'app/modules/editor/scripts/dom';

export type ToolName = 'select' | 'pen' | 'pencil' | 'rectangle' | 'ellipse' | 'line';

interface ToolButton {
  readonly tool: ToolName;
  readonly label: string;
  readonly shortcut: string;
  // A 24 by 24 icon.
  readonly icon: string;
}

// Material Design icons (Apache License 2.0), except for the line.
const TOOLS: ReadonlyArray<ToolButton> = [
  {
    tool: 'select',
    label: 'Move',
    shortcut: 'V',
    icon: 'M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 18.5V2z',
  },
  {
    tool: 'pen',
    label: 'Pen',
    shortcut: 'P',
    icon: 'M12 2 5 9l3 11h8l3-11-7-7zm0 3.5 1.5 6.2a1.5 1.5 0 1 1-3 0L12 5.5zM9 21h6v1H9z',
  },
  {
    tool: 'pencil',
    label: 'Pencil',
    shortcut: 'Shift+P',
    icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  },
  {
    tool: 'rectangle',
    label: 'Rectangle',
    shortcut: 'R',
    icon: 'M4 4h16v16H4V4zm2 2v12h12V6H6z',
  },
  {
    tool: 'ellipse',
    label: 'Ellipse',
    shortcut: 'O',
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14z',
  },
  {
    tool: 'line',
    label: 'Line',
    shortcut: 'L',
    icon: 'M4.4 18.2 18.2 4.4l1.4 1.4L5.8 19.6z',
  },
];

/**
 * The canvas editor's tools, as buttons over the top left of the canvas panel. It's plain DOM,
 * since the editor is loaded lazily and draws the rest of what it shows on a canvas.
 */
export class EditorToolbar {
  private readonly element: HTMLElement;
  private readonly buttons = new Map<ToolName, HTMLButtonElement>();
  private readonly removeListeners: Array<() => void> = [];

  constructor(
    root: HTMLElement,
    private readonly onSelect: (tool: ToolName) => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'canvas-editor-toolbar';
    this.element.setAttribute('role', 'toolbar');
    this.element.setAttribute('aria-label', 'Tools');
    this.element.setAttribute('aria-orientation', 'vertical');
    for (const { tool, label, shortcut, icon } of TOOLS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'canvas-editor-tool';
      button.title = `${label} (${shortcut})`;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-keyshortcuts', shortcut);
      button.dataset.tool = tool;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', icon);
      svg.appendChild(path);
      button.appendChild(svg);
      this.removeListeners.push(
        on(button, 'click', () => {
          this.onSelect(tool);
          // Leaves the keyboard shortcuts to the canvas editor, rather than to the button.
          button.blur();
        }),
      );
      this.buttons.set(tool, button);
      this.element.appendChild(button);
    }
    // Presses on the toolbar aren't gestures on the canvas under it.
    this.removeListeners.push(on(this.element, 'pointerdown', event => event.stopPropagation()));
    root.appendChild(this.element);
    this.setActiveTool('select');
  }

  setActiveTool(active: ToolName) {
    for (const [tool, button] of this.buttons) {
      button.setAttribute('aria-pressed', String(tool === active));
    }
  }

  /** Hides the toolbar, e.g. in action mode, where the editor's tools don't work. */
  setHidden(isHidden: boolean) {
    this.element.hidden = isHidden;
  }

  dispose() {
    this.removeListeners.forEach(remove => remove());
    this.element.remove();
  }
}
