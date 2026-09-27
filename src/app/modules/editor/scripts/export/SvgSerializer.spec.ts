import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { describe, expect, it } from 'vitest';

import { SvgSerializer } from '.';

describe('SvgSerializer', () => {
  function parse(svg: string) {
    return new DOMParser().parseFromString(svg, 'image/svg+xml');
  }

  function newPath(props: Partial<PathLayer> = {}) {
    return new PathLayer({
      name: 'arrow',
      children: [],
      pathData: new Path('M 0 0 L 10 10'),
      fillColor: '#000000',
      ...props,
    });
  }

  it('writes a group transform around its pivot', () => {
    const group = new GroupLayer({
      name: 'group',
      children: [newPath()],
      rotation: 30,
      pivotX: 12,
      pivotY: 6,
      translateX: 1,
    });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    const g = parse(SvgSerializer.toSvgString(vl)).getElementsByTagName('g')[0];
    expect(g.getAttribute('id')).toBe('group');
    expect(g.getAttribute('transform')).toBe('translate(1 0) rotate(30 12 6)');
  });

  it("wraps a transformed path in a group with the path's transform", () => {
    const vl = new VectorLayer({
      name: 'vector',
      children: [newPath({ scaleX: 2, pivotX: 12, pivotY: 12 })],
    });
    const doc = parse(SvgSerializer.toSvgString(vl));
    const g = doc.getElementsByTagName('g')[0];
    expect(g.getAttribute('id')).toBe('arrow_transform');
    expect(g.getAttribute('transform')).toBe('translate(12 12) scale(2 1) translate(-12 -12)');
    const path = g.getElementsByTagName('path')[0];
    expect(path.getAttribute('id')).toBe('arrow');
    expect(path.getAttribute('d')).toBe('M 0 0 L 10 10');
  });

  it("doesn't wrap a path with only a pivot", () => {
    const vl = new VectorLayer({ name: 'vector', children: [newPath({ pivotX: 12 })] });
    const doc = parse(SvgSerializer.toSvgString(vl));
    expect(doc.getElementsByTagName('g').length).toBe(0);
  });

  it('wraps transformed paths in sprite frames too', () => {
    const vl = new VectorLayer({ name: 'vector', children: [newPath({ rotation: 90 })] });
    const frame = SvgSerializer.toSvgSpriteFrameString(vl, 24, 0, '1');
    expect(frame).toContain('rotate(90 0 0)');
  });
});
