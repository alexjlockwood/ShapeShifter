import { VectorLayer } from 'app/modules/editor/model/layers';
import { CURRENT_PROJECT_VERSION } from 'app/modules/editor/model/projectVersion';
import { Animation } from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

import { FileExportService } from './fileexport.service';

function toJSON(extra: object = {}) {
  return JSON.parse(
    JSON.stringify({
      version: 1,
      layers: { vectorLayer: new VectorLayer().toJSON(), hiddenLayerIds: [] },
      timeline: { animation: new Animation().toJSON() },
      ...extra,
    }),
  );
}

describe('FileExportService.fromJSON', () => {
  it('reads the guides that the canvas editor saved', () => {
    const { guides } = FileExportService.fromJSON(toJSON({ guides: [{ axis: 'y', value: 6 }] }));
    expect(guides.map(({ axis, value }) => ({ axis, value }))).toEqual([{ axis: 'y', value: 6 }]);
  });

  it('reads a project from before the guides as having none', () => {
    expect(FileExportService.fromJSON(toJSON()).guides).toEqual([]);
  });

  it('does not flag an ordinary project as a newer version', () => {
    expect(FileExportService.fromJSON(toJSON()).newerVersion).toBe(false);
  });

  it('loads a version 2 project with a custom interpolator without flagging it as newer', () => {
    const vectorLayer = new VectorLayer({ name: 'vector', children: [] });
    const block = {
      layerId: vectorLayer.id,
      propertyName: 'alpha',
      type: 'number',
      fromValue: 0,
      toValue: 1,
      interpolator: 'M 0 0 C 0.3 0 0.2 1.3 1 1',
    };
    const parsed = FileExportService.fromJSON(
      toJSON({
        version: 2,
        layers: { vectorLayer: vectorLayer.toJSON(), hiddenLayerIds: [] },
        timeline: { animation: { ...new Animation().toJSON(), blocks: [block] } },
      }),
    );
    expect(parsed.newerVersion).toBe(false);
    expect(parsed.animation.blocks[0].interpolator).toBe('M 0 0 C 0.3 0 0.2 1.3 1 1');
  });

  it('flags a version above CURRENT_PROJECT_VERSION as newer', () => {
    const parsed = FileExportService.fromJSON(toJSON({ version: CURRENT_PROJECT_VERSION + 1 }));
    expect(parsed.newerVersion).toBe(true);
    // It still loads the project.
    expect(parsed.vectorLayer).toBeInstanceOf(VectorLayer);
  });

  it.each([0, -1, 1.5, '1', null, undefined])(
    'flags an odd version (%p) as newer, but still loads it',
    version => {
      const parsed = FileExportService.fromJSON(toJSON({ version }));
      expect(parsed.newerVersion).toBe(true);
      expect(parsed.vectorLayer).toBeInstanceOf(VectorLayer);
    },
  );

  it("throws a clear error for a project saved before Shape Shifter 1.0's format", () => {
    const preOneDotOh = {
      vectorLayer: new VectorLayer().toJSON(),
      animations: [new Animation().toJSON()],
    };
    expect(() => FileExportService.fromJSON(preOneDotOh)).toThrow(/older than 1\.0/);
  });

  it.each([undefined, null, 'garbage', 42, [], {}, { layers: {} }, { timeline: {} }])(
    'throws a clear error for garbage (%p)',
    garbage => {
      expect(() => FileExportService.fromJSON(garbage)).toThrow(
        /doesn't look like a Shape Shifter project/,
      );
    },
  );
});
