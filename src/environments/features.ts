/**
 * Features that can be turned on and off without a new build, so that unfinished ones can be
 * developed on master and tried on the live site. Each has a default for the build, which a URL
 * parameter can override for the browser.
 */
export interface Features {
  /** Editing and drawing paths on the canvas (see docs/canvas-editor.md). */
  readonly canvasEditor: boolean;
}

export const NO_FEATURES: Features = { canvasEditor: false };

/**
 * `?editor=1` turns the canvas editor on in this browser, `?editor=0` turns it off, and
 * `?editor=default` goes back to the build's default.
 */
export const CANVAS_EDITOR_PARAM = 'editor';
export const CANVAS_EDITOR_STORAGE_KEY = 'storage_key_canvas_editor';

/** Where overrides are remembered, e.g. localStorage. */
export interface FeatureStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Returns the features for this page load. A URL parameter wins and is remembered, so that it
 * lasts across reloads and links without it, then a remembered value, then the build's default.
 */
export function resolveFeatures({
  search,
  storage,
  buildDefault,
}: {
  readonly search: string;
  readonly storage: FeatureStorage;
  readonly buildDefault: Features;
}): Features {
  const fromUrl = parseFlag(new URLSearchParams(search).get(CANVAS_EDITOR_PARAM));
  if (fromUrl === 'default') {
    storage.removeItem(CANVAS_EDITOR_STORAGE_KEY);
    return buildDefault;
  }
  if (fromUrl !== undefined) {
    storage.setItem(CANVAS_EDITOR_STORAGE_KEY, fromUrl ? '1' : '0');
    return { canvasEditor: fromUrl };
  }
  const stored = parseFlag(storage.getItem(CANVAS_EDITOR_STORAGE_KEY));
  return typeof stored === 'boolean' ? { canvasEditor: stored } : buildDefault;
}

/** Returns the build's default features, from the `VITE_*` environment variables. */
export function getBuildFeatures(env: { readonly VITE_CANVAS_EDITOR?: string }): Features {
  return { canvasEditor: env.VITE_CANVAS_EDITOR === 'true' };
}

function parseFlag(value: string | null) {
  switch (value?.toLowerCase()) {
    case '1':
    case 'true':
    case 'on':
      return true;
    case '0':
    case 'false':
    case 'off':
      return false;
    case 'default':
      return 'default';
    default:
      return undefined;
  }
}
