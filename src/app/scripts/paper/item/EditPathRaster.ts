import * as paper from 'paper';

export class EditPathRaster extends paper.Raster {
  constructor(
    readonly type: 'segment' | 'handle-in' | 'handle-out',
    readonly segmentIndex: number,
    readonly isSelected: boolean,
    center: paper.Point,
  ) {
    super(
      type === 'segment'
        ? `/assets/paper/${isSelected ? 'vector-segment-selected' : 'vector-segment'}.png`
        : `/assets/paper/${isSelected ? 'vector-handle-selected' : 'vector-handle'}.png`,
      center,
    );
  }
}
