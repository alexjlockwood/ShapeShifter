import { ClipPathLayer, PathLayer } from 'app/modules/editor/model/layers';

import { SvgLoader } from '.';

describe('SvgLoader', () => {
  it(`can import simple SVG`, async () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path id="path" fill="#000" d="M 0 0 L 10 10 L 20 20 L 30 30"/>
</svg>
`;
    const vl = await SvgLoader.loadVectorLayerFromSvgString(svg, () => false);
    expect(vl.width).toBe(24);
    expect(vl.height).toBe(24);
    expect(vl.children.length).toBe(1);
    const pathLayer = vl.children[0] as PathLayer;
    expect(pathLayer.name).toBe('path');
    expect(pathLayer.fillColor).toBe('#000000');
    expect(pathLayer.pathData!.getPathString()).toBe('M 0 0 L 10 10 L 20 20 L 30 30');
  });

  it(`can import simple SVG with viewBox translation`, async () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 -10 24 24">
  <path id="path" fill="#000" d="M 0 0 L 10 10 L 20 20 L 30 30"/>
</svg>
`;
    const vl = await SvgLoader.loadVectorLayerFromSvgString(svg, () => false);
    expect(vl.width).toBe(24);
    expect(vl.height).toBe(24);
    expect(vl.children.length).toBe(1);
    const pathLayer = vl.children[0] as PathLayer;
    expect(pathLayer.name).toBe('path');
    expect(pathLayer.fillColor).toBe('#000000');
    expect(pathLayer.pathData!.getPathString()).toBe('M -5 10 L 5 20 L 15 30 L 25 40');
  });

  it(`names layers after their ids`, async () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <g id="arrow" transform="translate(2 2)">
    <path id="head" fill="#f00" d="M 10 0 L 20 10 L 10 20 Z"/>
    <path id="shaft" fill="#00f" d="M 0 8 L 10 8 L 10 12 L 0 12 Z"/>
  </g>
  <path fill="#0f0" d="M 0 0 L 4 0 L 4 4 Z"/>
</svg>
`;
    const vl = await SvgLoader.loadVectorLayerFromSvgString(svg, () => false);
    expect(vl.children.map(l => l.name)).toEqual(['arrow', 'path']);
    expect(vl.children[0].children.map(l => l.name)).toEqual(['head', 'shaft']);
  });

  it(`names layers after their types if nothing is left of their ids`, async () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <g id="图层" transform="translate(2 2)">
    <path id="路径一" fill="#f00" d="M 10 0 L 20 10 L 10 20 Z"/>
    <path id="路径二" fill="#00f" d="M 0 8 L 10 8 L 10 12 L 0 12 Z"/>
  </g>
</svg>
`;
    const vl = await SvgLoader.loadVectorLayerFromSvgString(svg, () => false);
    expect(vl.children.map(l => l.name)).toEqual(['group']);
    expect(vl.children[0].children.map(l => l.name)).toEqual(['path', 'path_1']);
  });

  it(`inherits paint from groups`, async () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <g fill="#f00" fill-rule="evenodd" stroke="#00f">
    <path d="M 0 0 L 10 0 L 10 10 Z"/>
    <g id="group" stroke-width="3">
      <path id="line" fill="none" d="M 12 12 L 20 20"/>
    </g>
  </g>
</svg>
`;
    const vl = await SvgLoader.loadVectorLayerFromSvgString(svg, () => false);
    const pathLayers: PathLayer[] = [];
    vl.walk(l => l instanceof PathLayer && pathLayers.push(l));
    expect(
      pathLayers.map(({ name, fillColor, fillType, strokeColor, strokeWidth }) => ({
        name,
        fillColor,
        fillType,
        strokeColor,
        strokeWidth,
      })),
    ).toEqual([
      {
        name: 'path',
        fillColor: '#ff0000',
        fillType: 'evenOdd',
        strokeColor: '#0000ff',
        strokeWidth: 1,
      },
      {
        name: 'line',
        fillColor: '',
        fillType: 'evenOdd',
        strokeColor: '#0000ff',
        strokeWidth: 3,
      },
    ]);
  });

  it(`imports stroke line caps and joins`, async () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path stroke="#000" stroke-linecap="round" stroke-linejoin="bevel" fill="none" d="M 0 0 L 10 10 L 20 0"/>
</svg>
`;
    const vl = await SvgLoader.loadVectorLayerFromSvgString(svg, () => false);
    const pathLayer = vl.children[0] as PathLayer;
    expect(pathLayer.strokeLinecap).toBe('round');
    expect(pathLayer.strokeLinejoin).toBe('bevel');
  });

  it(`replaces use elements with the content they reference`, async () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">
  <defs>
    <path id="tri" d="M 0 0 L 10 0 L 5 8 Z"/>
  </defs>
  <use xlink:href="#tri" fill="#f00"/>
  <use href="#tri" x="12" fill="#00f"/>
</svg>
`;
    const vl = await SvgLoader.loadVectorLayerFromSvgString(svg, () => false);
    const pathLayers: PathLayer[] = [];
    vl.walk(l => l instanceof PathLayer && pathLayers.push(l));
    expect(pathLayers.map(l => l.fillColor)).toEqual(['#ff0000', '#0000ff']);
    expect(pathLayers.map(l => l.pathData!.getPathString())).toEqual([
      'M 0 0 L 10 0 L 5 8 Z',
      'M 12 0 L 22 0 L 17 8 Z',
    ]);
  });

  it(`can import simple SVG with group/path transformations`, async () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M 0 0 L 10 10 L 20 20 L 30 30" transform="scale(2, 2)"/>
  <path d="M 0 0 L 10 10 L 20 20 L 30 30" transform="scale(2, 2) rotate(180)"/>
  <path d="M 0 0 L 10 10 L 20 20 L 30 30" transform="rotate(180) scale(2, 2)"/>
  <path d="M 0 0 L 10 10 L 20 20 L 30 30" transform="translate(10, 20) rotate(180) scale(2, 2)"/>
  <path d="M 0 0 L 10 10 L 20 20 L 30 30" transform="rotate(180) scale(2, 2) translate(10, 20)"/>
  <g transform="scale(2, 2)">
    <path d="M 0 0 L 10 10 L 20 20 L 30 30" transform="translate(10, 20)"/>
  </g>
</svg>
`;
    const vl = await SvgLoader.loadVectorLayerFromSvgString(svg, () => false);
    const paths = [
      'M 0 0 L 20 20 L 40 40 L 60 60',
      'M 0 0 L -20 -20 L -40 -40 L -60 -60',
      'M 0 0 L -20 -20 L -40 -40 L -60 -60',
      'M 10 20 L -10 0 L -30 -20 L -50 -40',
      'M -20 -40 L -40 -60 L -60 -80 L -80 -100',
      'M 20 40 L 40 60 L 60 80 L 80 100',
    ];
    const actualPath = (vl.children[0] as PathLayer).pathData!.getPathString();
    expect(actualPath).toBe(paths.join(' '));
  });

  it(`can import simple SVG with clip paths`, async () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <defs>
    <clipPath id="clip1" transform="scale(10, 10)">
      <path d="M 0 0 L 8 0 L 8 8 L 0 8 L 0 0"/>
    </clipPath>
    <clipPath id="clip2">
      <path d="M 4 4 L 24 4 L 24 24 L 4 24 L 4 4"/>
    </clipPath>
    <clipPath id="clip3" transform="translate(10, 10)">
      <path d="M 4 4 L 24 4 L 24 24 L 4 24 L 4 4" transform="translate(-10, -10)"/>
      <path d="M 6 6 L 18 6 L 18 18 L 6 18 L 6 6" transform="translate(-10, -10)"/>
    </clipPath>
  </defs>
  <g>
    <g id="group" transform="translate(64 64) translate(16 16) scale(4 4) translate(-16 -16)">
      <path d="M 0 0 L 8 0 L 8 8 L 0 8 L 0 0" fill="#ff0000" id="path1" clip-path="url(#clip2)"/>
      <path d="M 12 12 L 36 12 L 36 36 L 12 36 L 12 12" fill="#00ff00" id="path2" clip-path="url(#clip3)"/>
    </g>
  </g>
</svg>
`;
    await SvgLoader.loadVectorLayerFromSvgString(svg, () => false);
    // TODO: test stuff
    expect(true).toBe(true);
  });

  it(`applies a clip path's transform after its paths' transforms`, async () => {
    // The id keeps svgo from baking the path's transform into its path data.
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <clipPath id="clip" transform="translate(10 0)">
    <path id="cp" transform="scale(2)" d="M0 0h5v5H0z"/>
  </clipPath>
  <path id="path" d="M0 0h24v24H0z" clip-path="url(#clip)"/>
</svg>
`;
    const vl = await SvgLoader.loadVectorLayerFromSvgString(svg, () => false);
    const clipPaths: ClipPathLayer[] = [];
    vl.walk(layer => layer instanceof ClipPathLayer && clipPaths.push(layer));
    expect(clipPaths).toHaveLength(1);
    // Scaled to 0..10, then translated to 10..20.
    const { l, t, r, b } = clipPaths[0].pathData!.getBoundingBox();
    expect({ l, t, r, b }).toEqual({ l: 10, t: 0, r: 20, b: 10 });
  });
});
