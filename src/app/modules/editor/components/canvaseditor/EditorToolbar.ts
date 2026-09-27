import { on } from 'app/modules/editor/scripts/dom';
import type { CanvasSettings } from 'app/modules/editor/services/canvassettings.service';
import { ShortcutService } from 'app/modules/editor/services/shortcut.service';

export type ToolName = 'select' | 'pen' | 'pencil' | 'rectangle' | 'ellipse' | 'line';

interface ToolButton {
  readonly tool: ToolName;
  readonly label: string;
  readonly shortcut: string;
  // A 24 by 24 icon.
  readonly icon: string;
}

// Simple shapes drawn for the toolbar, and Material Design's pencil (Apache License 2.0).
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

interface SettingButton {
  readonly setting: keyof CanvasSettings;
  readonly label: string;
  readonly shortcut: string;
  readonly icon: string;
}

// Toggles for how the canvas shows, after the tools. The shortcuts are Figma's.
const SETTINGS: ReadonlyArray<SettingButton> = [
  {
    setting: 'showRulers',
    label: 'Rulers',
    shortcut: 'Shift+R',
    icon: 'M3 8h18v8H3V8zm2 2v4h14v-4h-1v2h-1v-2h-2v2h-1v-2h-2v2h-1v-2H9v2H8v-2H6v2H5z',
  },
  {
    setting: 'showPixelGrid',
    label: 'Pixel grid',
    shortcut: "Shift+'",
    icon: 'M4 4h16v16H4V4zm2 2v3h3V6H6zm5 0v3h2V6h-2zm4 0v3h3V6h-3zM6 11v2h3v-2H6zm5 0v2h2v-2h-2zm4 0v2h3v-2h-3zM6 15v3h3v-3H6zm5 0v3h2v-3h-2zm4 0v3h3v-3h-3z',
  },
  {
    setting: 'snapToPixelGrid',
    label: 'Snap to pixel grid',
    // Cmd on Macs, and Ctrl elsewhere.
    shortcut: "Command+Shift+'",
    icon: 'M6 7h4v3a2 2 0 1 0 4 0V7h4v3a6 6 0 1 1-12 0V7zM6 3h4v3H6V3zm8 0h4v3h-4V3z',
  },
];

/**
 * The canvas editor's tools, as buttons over the top left of the canvas panel. It's plain DOM,
 * since the editor is loaded lazily and draws the rest of what it shows on a canvas.
 */
export class EditorToolbar {
  private readonly element: HTMLElement;
  private readonly buttons = new Map<ToolName, HTMLButtonElement>();
  private readonly settingButtons = new Map<keyof CanvasSettings, HTMLButtonElement>();
  private readonly removeListeners: Array<() => void> = [];

  constructor(
    root: HTMLElement,
    private readonly callbacks: {
      readonly onSelect: (tool: ToolName) => void;
      readonly onToggle: (setting: keyof CanvasSettings) => void;
      readonly onHover: () => void;
    },
  ) {
    this.element = document.createElement('div');
    this.element.className = 'canvas-editor-toolbar';
    this.element.setAttribute('role', 'toolbar');
    this.element.setAttribute('aria-label', 'Tools');
    this.element.setAttribute('aria-orientation', 'vertical');
    for (const { tool, label, shortcut, icon } of TOOLS) {
      const button = this.addButton(label, shortcut, icon, () => this.callbacks.onSelect(tool));
      button.dataset.tool = tool;
      this.buttons.set(tool, button);
    }
    const separator = document.createElement('div');
    separator.className = 'canvas-editor-toolbar-separator';
    separator.setAttribute('role', 'separator');
    this.element.appendChild(separator);
    for (const { setting, label, shortcut, icon } of SETTINGS) {
      const button = this.addButton(label, shortcut, icon, () => this.callbacks.onToggle(setting));
      button.dataset.setting = setting;
      button.tabIndex = -1;
      this.settingButtons.set(setting, button);
    }
    // Presses and hovers over the toolbar aren't gestures on the canvas under it.
    this.removeListeners.push(
      on(this.element, 'pointerdown', event => event.stopPropagation()),
      on(this.element, 'pointermove', event => event.stopPropagation()),
      on(this.element, 'pointerenter', () => this.callbacks.onHover()),
      on(this.element, 'keydown', event => this.onKeyDown(event)),
    );
    root.appendChild(this.element);
    this.setActiveTool('select');
  }

  private addButton(label: string, shortcut: string, icon: string, onClick: () => void) {
    const isMac = ShortcutService.isMac();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'canvas-editor-tool';
    button.title = `${label} (${shortcut.replace('Command', isMac ? 'Cmd' : 'Ctrl')})`;
    button.setAttribute('aria-label', label);
    button.setAttribute(
      'aria-keyshortcuts',
      shortcut.replace('Command', isMac ? 'Meta' : 'Control'),
    );
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', icon);
    svg.appendChild(path);
    button.appendChild(svg);
    this.removeListeners.push(
      on(button, 'click', event => {
        onClick();
        if (event.detail > 0) {
          // A click, rather than Enter or Space, so the keyboard shortcuts go back to the canvas
          // editor instead of to the button.
          button.blur();
        }
      }),
    );
    this.element.appendChild(button);
    return button;
  }

  /** Shows which of the settings are on. */
  setSettings(settings: CanvasSettings) {
    for (const [setting, button] of this.settingButtons) {
      button.setAttribute('aria-pressed', String(settings[setting]));
    }
  }

  setActiveTool(active: ToolName) {
    for (const [tool, button] of this.buttons) {
      button.setAttribute('aria-pressed', String(tool === active));
      // One tab stop for the whole toolbar, on the active tool, and the arrow keys move between
      // the tools.
      button.tabIndex = tool === active ? 0 : -1;
    }
  }

  private onKeyDown(event: KeyboardEvent) {
    const buttons = [...this.buttons.values(), ...this.settingButtons.values()];
    const index = buttons.findIndex(button => button === document.activeElement);
    const offsets: Record<string, number> = {
      ArrowUp: -1,
      ArrowLeft: -1,
      ArrowDown: 1,
      ArrowRight: 1,
    };
    const offset = offsets[event.key];
    if (index < 0 || (offset === undefined && event.key !== 'Home' && event.key !== 'End')) {
      return undefined;
    }
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + offset + buttons.length) % buttons.length;
    buttons[next].focus();
    // Rather than nudging the selection or rewinding.
    return false;
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
