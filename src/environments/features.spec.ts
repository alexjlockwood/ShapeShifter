import {
  CANVAS_EDITOR_STORAGE_KEY,
  FeatureStorage,
  getBuildFeatures,
  getCanvasEditorResetSearch,
  isCanvasEditorPreview,
  resolveFeatures,
  withoutCanvasEditorReset,
} from './features';

function createStorage(values: Record<string, string> = {}): FeatureStorage & {
  values: Record<string, string>;
} {
  return {
    values,
    getItem: key => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
    removeItem: key => {
      delete values[key];
    },
  };
}

const ON = { canvasEditor: true };
const OFF = { canvasEditor: false };

describe('resolveFeatures', () => {
  it('uses the build default when nothing overrides it', () => {
    expect(resolveFeatures({ search: '', storage: createStorage(), buildDefault: ON })).toEqual(ON);
    expect(resolveFeatures({ search: '', storage: createStorage(), buildDefault: OFF })).toEqual(
      OFF,
    );
  });

  it('turns the editor on or off from the URL, and remembers it', () => {
    const storage = createStorage();
    expect(resolveFeatures({ search: '?editor=1', storage, buildDefault: OFF })).toEqual(ON);
    expect(resolveFeatures({ search: '', storage, buildDefault: OFF })).toEqual(ON);
    expect(resolveFeatures({ search: '?x=y&editor=off', storage, buildDefault: ON })).toEqual(OFF);
    expect(resolveFeatures({ search: '', storage, buildDefault: ON })).toEqual(OFF);
  });

  it('accepts the usual ways of writing on and off', () => {
    for (const value of ['1', 'true', 'on', 'TRUE']) {
      const search = `?editor=${value}`;
      expect(resolveFeatures({ search, storage: createStorage(), buildDefault: OFF })).toEqual(ON);
    }
    for (const value of ['0', 'false', 'off']) {
      const search = `?editor=${value}`;
      expect(resolveFeatures({ search, storage: createStorage(), buildDefault: ON })).toEqual(OFF);
    }
  });

  it('forgets the remembered value with ?editor=default', () => {
    const storage = createStorage({ [CANVAS_EDITOR_STORAGE_KEY]: '1' });
    expect(resolveFeatures({ search: '?editor=default', storage, buildDefault: OFF })).toEqual(OFF);
    expect(storage.values).toEqual({});
  });

  it('ignores values it does not recognize', () => {
    const storage = createStorage({ [CANVAS_EDITOR_STORAGE_KEY]: 'maybe' });
    expect(resolveFeatures({ search: '?editor=maybe', storage, buildDefault: ON })).toEqual(ON);
    expect(storage.values).toEqual({ [CANVAS_EDITOR_STORAGE_KEY]: 'maybe' });
  });
});

describe('isCanvasEditorPreview', () => {
  it('is only a preview when the browser turned on what the build leaves off', () => {
    expect(isCanvasEditorPreview(ON, OFF)).toBe(true);
    expect(isCanvasEditorPreview(ON, ON)).toBe(false);
    expect(isCanvasEditorPreview(OFF, OFF)).toBe(false);
    expect(isCanvasEditorPreview(OFF, ON)).toBe(false);
  });

  it('is a preview for a production build that ?editor=1 turned on, until ?editor=default', () => {
    const storage = createStorage();
    const turnedOn = resolveFeatures({ search: '?editor=1', storage, buildDefault: OFF });
    expect(isCanvasEditorPreview(turnedOn, OFF)).toBe(true);
    const later = resolveFeatures({ search: '', storage, buildDefault: OFF });
    expect(isCanvasEditorPreview(later, OFF)).toBe(true);
    const search = getCanvasEditorResetSearch('?editor=1');
    const reset = resolveFeatures({ search, storage, buildDefault: OFF });
    expect(isCanvasEditorPreview(reset, OFF)).toBe(false);
    expect(storage.values).toEqual({});
  });
});

describe('getCanvasEditorResetSearch', () => {
  it('replaces the parameter, and keeps the others as they are', () => {
    expect(getCanvasEditorResetSearch('')).toBe('?editor=default');
    expect(getCanvasEditorResetSearch('?editor=1')).toBe('?editor=default');
    expect(getCanvasEditorResetSearch('?project=demos/a.shapeshifter&editor=on&x=%20')).toBe(
      '?project=demos/a.shapeshifter&x=%20&editor=default',
    );
    // Every copy, since the browser reads the first one.
    expect(getCanvasEditorResetSearch('?editor&editor=1')).toBe('?editor=default');
  });
});

describe('withoutCanvasEditorReset', () => {
  it('removes ?editor=default, and keeps the others as they are', () => {
    expect(withoutCanvasEditorReset('?editor=default')).toBe('');
    expect(withoutCanvasEditorReset('?project=demos/a.shapeshifter&editor=DEFAULT')).toBe(
      '?project=demos/a.shapeshifter',
    );
    expect(withoutCanvasEditorReset('?editor=default&x=%20')).toBe('?x=%20');
  });

  it('leaves the query string alone when it has nothing to remove', () => {
    for (const search of ['', '?', '?editor=1', '?project=a%2Fb&editor=off', '?defaulteditor=1']) {
      expect(withoutCanvasEditorReset(search)).toBe(search);
    }
  });
});

describe('getBuildFeatures', () => {
  it('turns the editor on only when the variable is true', () => {
    expect(getBuildFeatures({ VITE_CANVAS_EDITOR: 'true' })).toEqual(ON);
    expect(getBuildFeatures({ VITE_CANVAS_EDITOR: 'false' })).toEqual(OFF);
    expect(getBuildFeatures({})).toEqual(OFF);
  });
});
