import { VectorLayer, GroupLayer, PathLayer } from '.';

describe('AbstractLayer', () => {
  const pl1 = new PathLayer('pl1', undefined);
  const pl2 = new PathLayer('pl2', undefined);
  const pl3 = new PathLayer('pl3', undefined);
  const pl4 = new PathLayer('pl4', undefined);
  const pl5 = new PathLayer('pl5', undefined);
  const pl6 = new PathLayer('pl6', undefined);
  const pl7 = new PathLayer('pl7', undefined);
  const pl8 = new PathLayer('pl8', undefined);
  const gl1 = new GroupLayer([pl1, pl2, pl3, pl4], 'gl1');
  const gl2 = new GroupLayer([gl1, pl5], 'gl2');
  const gl3 = new GroupLayer([pl6, gl2], 'gl3');
  const gl4 = new GroupLayer([pl7, pl8], 'gl4');
  const vl = new VectorLayer([gl3, gl4], 'vector');
  it('findLayerById #1', () => {
    expect(vl.findLayer('vector')).toEqual(vl);
  });
  it('findLayerById #2', () => {
    expect(vl.findLayer('pl1').id).toEqual('pl1');
  });
});
