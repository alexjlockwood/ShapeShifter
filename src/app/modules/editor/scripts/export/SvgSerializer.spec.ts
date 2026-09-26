import { GroupLayer, Layer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
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
});
