import { VectorLayer } from 'app/modules/editor/model/layers';
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
});
