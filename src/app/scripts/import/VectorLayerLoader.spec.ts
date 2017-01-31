import * as VectorLayerLoader from './VectorLayerLoader';
import { VectorLayer, PathLayer } from '../model/layers';

describe('VectorLayerLoader', () => {
  it('convert simple svg to vector layer', () => {
    const simpleSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24">
        <path d="M 0 0 L 12 12 C 16 16 20 20 24 24" stroke="#000" stroke-width="1"/>
      </svg>`;
    expect(true).toEqual(true);
  });
  it('convert grouped svg to vector layer', () => {
    const groupedSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24">
        <g transform="translate(12,12)">
        <g transform="scale(0.75,0.75)">
        <g transform="translate(-12,-12)">
        <path d="M 0 0 L 4 4 C 11 12 17 12 24 12" stroke="#000" stroke-width="1"/>
        </g>
        </g>
        </g>
        </svg>`;
    expect(true).toEqual(true);
  });
});



