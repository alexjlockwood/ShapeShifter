import * as paper from 'paper';

export class FocusedPathRaster extends paper.Raster {
  constructor(
    public readonly type: 'segment' | 'handle-in' | 'handle-out',
    public readonly segmentIndex: number,
    public readonly isSelected: boolean,
    center: paper.Point,
  ) {
    super(
      type === 'segment'
        ? `/assets/${isSelected ? 'vector_anchor_selected' : 'vector_anchor'}.png`
        : `/assets/${isSelected ? 'vector_handle_selected' : 'vector_handle'}.png`,
      center,
    );
  }
}
