import { PathLayer } from 'app/model/layers';

import { SvgLoader } from '.';

describe('SvgLoader', () => {
  it(`can import simple SVG`, () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path id="test_path" fill="#000" d="M 0 0 L 10 10 L 20 20 L 30 30"/>
</svg>
`;
    SvgLoader.loadVectorLayerFromSvgStringWithCallback(
      svg,
      vl => {
        expect(vl.width).toBe(24);
        expect(vl.height).toBe(24);
        expect(vl.children.length).toBe(1);
        const pathLayer = vl.children[0] as PathLayer;
        expect(pathLayer.name).toBe('test_path');
        expect(pathLayer.fillColor).toBe('#000');
        expect(pathLayer.pathData.getPathString()).toBe('M 0 0 L 10 10 L 20 20 L 30 30');
      },
      () => false,
    );
  });

  it(`can import simple SVG with viewBox translation`, () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 -10 24 24">
  <path id="test_path" fill="#000" d="M 0 0 L 10 10 L 20 20 L 30 30"/>
</svg>
`;
    SvgLoader.loadVectorLayerFromSvgStringWithCallback(
      svg,
      vl => {
        expect(vl.width).toBe(24);
        expect(vl.height).toBe(24);
        expect(vl.children.length).toBe(1);
        const pathLayer = vl.children[0] as PathLayer;
        expect(pathLayer.name).toBe('test_path');
        expect(pathLayer.fillColor).toBe('#000');
        expect(pathLayer.pathData.getPathString()).toBe('M -5 10 L 5 20 L 15 30 L 25 40');
      },
      () => false,
    );
  });

  it(`can import simple SVG with group/path transformations`, () => {
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
    SvgLoader.loadVectorLayerFromSvgStringWithCallback(
      svg,
      vl => {
        const paths = [
          'M 0 0 L 20 20 L 40 40 L 60 60',
          'M 0 0 L -20 -20 L -40 -40 L -60 -60',
          'M 0 0 L -20 -20 L -40 -40 L -60 -60',
          'M 10 20 L -10 0 L -30 -20 L -50 -40',
          'M -20 -40 L -40 -60 L -60 -80 L -80 -100',
          'M 20 40 L 40 60 L 60 80 L 80 100',
        ];
        const actualPath = (vl.children[0] as PathLayer).pathData.getPathString();
        expect(actualPath).toBe(paths.join(' '));
      },
      () => false,
    );
  });

  it(`can import simple SVG with clip paths`, () => {
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
    SvgLoader.loadVectorLayerFromSvgStringWithCallback(
      svg,
      vl => {
        // TODO: test stuff
        // console.info(vl);
      },
      () => false,
    );
  });
});
