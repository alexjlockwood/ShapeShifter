import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import type { Path } from 'app/modules/editor/model/paths';

import { collectDocumentColors } from './documentColors';

function newPath(name: string, fillColor: string, strokeColor: string) {
  return new PathLayer({
    name,
    children: [],
    pathData: 'M 0 0 L 1 1' as unknown as Path,
    fillColor,
    strokeColor,
  });
}

describe('#collectDocumentColors', () => {
  it('collects the canvas color and every path layer fill and stroke color', () => {
    const a = newPath('a', '#ff0000', '');
    const b = newPath('b', '', '#00ff00');
    const vl = new VectorLayer({ name: 'vector', canvasColor: '#0000ff', children: [a, b] });
    expect(collectDocumentColors(vl, new Animation())).toEqual(['#0000ff', '#ff0000', '#00ff00']);
  });

  it('walks into groups', () => {
    const path = newPath('path', '#ff0000', '#00ff00');
    const group = new GroupLayer({ name: 'group', children: [path] });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    expect(collectDocumentColors(vl, new Animation())).toEqual(['#ff0000', '#00ff00']);
  });

  it('collects the from and to values of color blocks', () => {
    const path = newPath('path', '#ff0000', '');
    const vl = new VectorLayer({ name: 'vector', children: [path] });
    const animation = new Animation({
      blocks: [
        AnimationBlock.from({
          type: 'color',
          layerId: path.id,
          propertyName: 'fillColor',
          fromValue: '#ff0000',
          toValue: '#00ff00',
        }),
      ],
    });
    expect(collectDocumentColors(vl, animation)).toEqual(['#ff0000', '#00ff00']);
  });

  it('leaves out no color and deduplicates repeats, keeping the first order', () => {
    const a = newPath('a', '#ff0000', '');
    const b = newPath('b', '#ff0000', '');
    const vl = new VectorLayer({ name: 'vector', canvasColor: '', children: [a, b] });
    const animation = new Animation({
      blocks: [
        AnimationBlock.from({
          type: 'color',
          layerId: a.id,
          propertyName: 'fillColor',
          fromValue: '#ff0000',
          toValue: '',
        }),
      ],
    });
    expect(collectDocumentColors(vl, animation)).toEqual(['#ff0000']);
  });

  it('ignores number and path blocks', () => {
    const path = newPath('path', '#ff0000', '');
    const vl = new VectorLayer({ name: 'vector', children: [path] });
    const animation = new Animation({
      blocks: [
        AnimationBlock.from({
          type: 'number',
          layerId: path.id,
          propertyName: 'fillAlpha',
          fromValue: 0,
          toValue: 1,
        }),
      ],
    });
    expect(collectDocumentColors(vl, animation)).toEqual(['#ff0000']);
  });
});
