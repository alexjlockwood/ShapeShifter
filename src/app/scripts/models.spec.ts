import { } from 'jasmine';
import { Layer, VectorLayer, GroupLayer, PathLayer } from './models';
import { VectorLayerBuilder, GroupLayerBuilder } from './testutil';

describe('AbstractLayer', () => {
  const pl1 = new PathLayer('pl1', null);
  const pl2 = new PathLayer('pl2', null);
  const pl3 = new PathLayer('pl3', null);
  const pl4 = new PathLayer('pl4', null);
  const pl5 = new PathLayer('pl5', null);
  const pl6 = new PathLayer('pl6', null);
  const pl7 = new PathLayer('pl7', null);
  const pl8 = new PathLayer('pl8', null);
  const gl1 = new GroupLayer([pl1, pl2, pl3, pl4], 'gl1');
  const gl2 = new GroupLayer([gl1, pl5], 'gl2');
  const gl3 = new GroupLayer([pl6, gl2], 'gl3');
  const gl4 = new GroupLayer([pl7, pl8], 'gl4');
  const vl = new VectorLayer([gl3, gl4], 'vector');
  it('findLayerById #1', () => {
    expect(vl.findLayerById('vector')).toEqual(vl);
  });
  it('findLayerById #2', () => {
    console.log(vl.findLayerById('pl1'));
    expect(vl.findLayerById('pl1').id).toEqual('pl1');
  });
});
