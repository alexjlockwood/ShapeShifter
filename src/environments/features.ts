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

/**
 * Returns whether the canvas editor is on only because this browser turned it on, e.g. with
 * `?editor=1` on the live site. It's remembered for good and changes shortcuts like R, so the app
 * offers a way back to the build's default.
 */
export function isCanvasEditorPreview(features: Features, buildDefault: Features) {
  return features.canvasEditor && !buildDefault.canvasEditor;
}

/**
 * Returns the query string that goes back to the build's default for the canvas editor, keeping
 * the other parameters, like `?project=`, as they are.
 */
export function getCanvasEditorResetSearch(search: string) {
  const params = splitParams(search).filter(
    param => !new URLSearchParams(param).has(CANVAS_EDITOR_PARAM),
  );
  return joinParams([...params, `${CANVAS_EDITOR_PARAM}=default`]);
}

/**
 * Returns the query string without `?editor=default`, which has done its job once the page has
 * loaded, so that it doesn't end up in links and bookmarks. Anything else is left as it is.
 */
export function withoutCanvasEditorReset(search: string) {
  const params = splitParams(search);
  const kept = params.filter(
    param => parseFlag(new URLSearchParams(param).get(CANVAS_EDITOR_PARAM)) !== 'default',
  );
  return kept.length === params.length ? search : joinParams(kept);
}

/**
 * Splits a query string into its `name=value` pairs, still encoded, so that joining them again
 * leaves the ones that weren't changed alone.
 */
function splitParams(search: string) {
  return search
    .replace(/^\?/, '')
    .split('&')
    .filter(param => param !== '');
}

function joinParams(params: readonly string[]) {
  return params.length ? `?${params.join('&')}` : '';
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
