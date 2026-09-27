import { getStoredItem, setStoredItem } from 'app/modules/editor/scripts/storage';
import { BehaviorSubject } from 'rxjs';

/** How the canvas editor shows the canvas. They're preferences, so undo leaves them alone. */
export interface CanvasSettings {
  /** The rulers, and the guides dragged out of them. Shift+R toggles them. */
  readonly showRulers: boolean;
  /** Lines between the units, once they're far enough apart to see. */
  readonly showPixelGrid: boolean;
  /** Whether moves, handles, and new points snap to whole units. */
  readonly snapToPixelGrid: boolean;
}

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  showRulers: true,
  showPixelGrid: true,
  snapToPixelGrid: true,
};

const STORAGE_KEY = 'canvas_editor_settings';

/**
 * Holds the canvas editor's settings, remembered in this browser. Values that are missing or of
 * the wrong type in storage fall back to the defaults.
 */
export class CanvasSettingsService {
  private readonly settings = new BehaviorSubject<CanvasSettings>(readSettings());

  asObservable() {
    return this.settings.asObservable();
  }

  getSettings() {
    return this.settings.getValue();
  }

  update(changes: Partial<CanvasSettings>) {
    const settings = { ...this.getSettings(), ...changes };
    setStoredItem(STORAGE_KEY, JSON.stringify(settings));
    this.settings.next(settings);
  }

  toggle(name: keyof CanvasSettings) {
    this.update({ [name]: !this.getSettings()[name] });
  }
}

function readSettings(): CanvasSettings {
  let stored: unknown;
  try {
    stored = JSON.parse(getStoredItem(STORAGE_KEY) ?? '{}');
  } catch {
    stored = undefined;
  }
  const values = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const read = (name: keyof CanvasSettings) => {
    const value = values[name];
    return typeof value === 'boolean' ? value : DEFAULT_CANVAS_SETTINGS[name];
  };
  return {
    showRulers: read('showRulers'),
    showPixelGrid: read('showPixelGrid'),
    snapToPixelGrid: read('snapToPixelGrid'),
  };
}
