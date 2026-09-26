import {
  CANVAS_EDITOR_STORAGE_KEY,
  FeatureStorage,
  getBuildFeatures,
  resolveFeatures,
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

describe('getBuildFeatures', () => {
  it('turns the editor on only when the variable is true', () => {
    expect(getBuildFeatures({ VITE_CANVAS_EDITOR: 'true' })).toEqual(ON);
    expect(getBuildFeatures({ VITE_CANVAS_EDITOR: 'false' })).toEqual(OFF);
    expect(getBuildFeatures({})).toEqual(OFF);
  });
});
