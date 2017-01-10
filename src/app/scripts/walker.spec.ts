import { } from 'jasmine';
import { Walker } from './walker';
import { Layer, VectorLayer, GroupLayer, PathLayer } from './models';

describe('Walk', () => {
  it('walk', () => {
    const tree = {
      'A': { 'aa': 'aaa', 'bb': 'bbb' },
      'B': ['c', 'c'],
    };
    //console.log('=====');
    //_.walk.preorder(tree, function(value, key, parent) {
    //  console.log(key + ': ' + value);
    //});
    //console.log('=====');
    //_.walk.postorder(tree, function(value, key, parent) {
    //  console.log(key + ': ' + value);
    //});
    //console.log('=====');
    expect(true).toEqual(true);
  });

  const pl1 = new PathLayer('pl1', null);
  const pl2 = new PathLayer('pl2', null);
  const pl3 = new PathLayer('pl3', null);
  const pl4 = new PathLayer('pl4', null);
  const pl5 = new PathLayer('pl5', null);
  const pl6 = new PathLayer('pl6', null);
  const pl7 = new PathLayer('pl7', null);
  const pl8 = new PathLayer('pl8', null);
  const gl1 = new GroupLayer([pl1/*, pl2, pl3, pl4*/], 'gl1');
  //const gl2 = new GroupLayer([gl1, pl5], 'gl2');
  //const gl3 = new GroupLayer([pl6, gl2], 'gl3');
  //const gl4 = new GroupLayer([pl7, pl8], 'gl4');
  const vl = new VectorLayer([gl1], 'vector');

  const walker = new Walker(o => {
    if ((o instanceof VectorLayer || o instanceof GroupLayer) && o.children) {
      return o.children;
    }
    return null;
  });

  it('preorder', () => {
    console.log('=====');
    walker.preorder(pl1, visit);
    expect(true).toEqual(true);
  });
  it('postorder', () => {
    console.log('=====');
    walker.postorder(pl1, visit);
    expect(true).toEqual(true);
  });
  it('find', () => {
    console.log('=====');
    walker.find(pl1, visit);
    expect(true).toEqual(true);
  });
  it('filter', () => {
    console.log('=====');
    const strs =
      walker.filter(vl, walker.preorder, n => (n instanceof PathLayer) && n.id === 'pl1');
    console.log(strs);
    expect(true).toEqual(true);
  });
  it('map', () => {
    console.log('=====');
    const result = walker.map(vl, walker.preorder, (v, k, p) => {
      if (v instanceof PathLayer) return 'path';
      if (v instanceof GroupLayer) return 'group';
      if (v instanceof VectorLayer) return 'vector';
    });
    console.log(result);
    expect(true).toEqual(true);
  });
  it('reduce', () => {
    console.log('========');
    const result = walker.reduce(vl, (memo, v) => {
      if (v instanceof PathLayer) return new PathLayer('path', null);
      if (v instanceof GroupLayer) {
        return new GroupLayer(memo, 'group');
      }
      if (v instanceof VectorLayer) return new VectorLayer(memo, 'vector');
    });
    console.log(result);
    expect(true).toEqual(true);
  });
});

function visit(value, key, parent) {
  console.log(key + ': ' + value);
}
