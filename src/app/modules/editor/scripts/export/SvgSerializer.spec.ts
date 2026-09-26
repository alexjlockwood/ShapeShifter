import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';

import { SvgSerializer } from '.';

describe('SvgSerializer', () => {
  function toSvgDocument(...children: Layer[]) {
    const vl = new VectorLayer({ name: 'vector', children });
    const svg = SvgSerializer.toSvgString(vl);
    return new DOMParser().parseFromString(svg, 'image/svg+xml');
  }

  function newPath(name: string, args: Partial<PathLayer> = {}) {
    return new PathLayer({ name, children: [], pathData: new Path('M 0 0 L 10 0'), ...args });
  }

  it('trims paths in their own units inside scaled groups', () => {
    const path = newPath('path', { strokeColor: '#000000', strokeWidth: 1, trimPathEnd: 0.5 });
    const group = new GroupLayer({ name: 'group', children: [path], scaleX: 2, scaleY: 2 });
    const pathNode = toSvgDocument(group).querySelector('path')!;
    // stroke-dasharray is in the path's own units (under the group's transform), so half of the
    // 10 unit line is 5 units long, not 10.
    expect(pathNode.getAttribute('stroke-dasharray')).toBe('5,5');
  });

  it('writes a stroke width of 0, since the SVG default is 1', () => {
    const doc = toSvgDocument(
      newPath('stroked', { strokeColor: '#000000', strokeWidth: 0 }),
      newPath('unstroked', { strokeWidth: 0 }),
    );
    expect(doc.getElementById('stroked')!.getAttribute('stroke-width')).toBe('0');
    expect(doc.getElementById('unstroked')!.hasAttribute('stroke-width')).toBe(false);
  });

  it('gives each clip path a unique id', () => {
    const newClipPath = (name: string, pathData: string) =>
      new ClipPathLayer({ name, children: [], pathData: new Path(pathData) });
    // 'path_1' is the name getUniqueName generates for a second layer named 'path'.
    const doc = toSvgDocument(
      newClipPath('clip_a', 'M 0 0 L 5 0 L 5 5 Z'),
      newClipPath('clip_b', 'M 1 1 L 4 1 L 4 4 Z'),
      newPath('path'),
      newPath('path_1'),
    );
    const ids = Array.from(doc.querySelectorAll('clipPath')).map(n => n.getAttribute('id'));
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    // Each layer is clipped by the first clip path, intersected with the second.
    for (const name of ['path', 'path_1']) {
      const clipPathUrl = doc.getElementById(name)!.getAttribute('clip-path');
      const first = doc.getElementById(clipPathUrl!.slice('url(#'.length, -1))!;
      expect(first.querySelector('path')!.getAttribute('d')).toBe('M 0 0 L 5 0 L 5 5 Z');
      const nextUrl = first.querySelector('path')!.getAttribute('clip-path');
      const second = doc.getElementById(nextUrl!.slice('url(#'.length, -1))!;
      expect(second.querySelector('path')!.getAttribute('d')).toBe('M 1 1 L 4 1 L 4 4 Z');
    }
  });

  it("doesn't give a clip path the same id as a layer", () => {
    const doc = toSvgDocument(
      newPath('clip_path'),
      new ClipPathLayer({ name: 'mask', children: [], pathData: new Path('M 0 0 L 5 0 L 5 5 Z') }),
      newPath('path'),
    );
    const ids = Array.from(doc.querySelectorAll('[id]')).map(n => n.getAttribute('id'));
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    // The clipped layer still references its clip path.
    const clipPathUrl = doc.getElementById('path')!.getAttribute('clip-path');
    const clipPath = doc.getElementById(clipPathUrl!.slice('url(#'.length, -1))!;
    expect(clipPath.tagName).toBe('clipPath');
  });
});
