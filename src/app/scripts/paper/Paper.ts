import { VectorLayer } from 'app/model/layers';
import { State, Store } from 'app/store';
import { getVectorLayer } from 'app/store/layers/selectors';
import * as paper from 'paper';

import { ToolSwitcher } from './ToolSwitcher';
import * as Guides from './util/Guides';
import * as Layers from './util/Layers';

let toolSwitcher: ToolSwitcher;

export function attach(canvas: HTMLCanvasElement, store: Store<State>) {
  if (toolSwitcher) {
    // We've already been initialized, so do nothing.
    return;
  }
  paper.setup(canvas);
  paper.settings.handleSize = 8;
  paper.settings.applyMatrix = false;
  // TODO: should we set a hit tolerance here?
  paper.settings.hitTolerance = 0;
  const mainLayer = new paper.Layer({ name: 'mainLayer' });
  paper.project.addLayer(mainLayer);
  paper.project.addLayer(Guides.createGuideLayer());
  mainLayer.activate();

  toolSwitcher = new ToolSwitcher(store);

  store.select(getVectorLayer).subscribe(vl => {
    // TODO: make this more efficient?
    paper.project.activeLayer.removeChildren();
    paper.project.activeLayer.addChild(Layers.fromVectorLayer(vl));
  });
}

export function updateProjectDimensions(
  viewportWidth: number,
  viewportHeight: number,
  viewWidth: number,
  viewHeight: number,
) {
  paper.view.viewSize = new paper.Size(viewWidth, viewHeight);
  paper.project.layers.forEach(l => {
    const sx = viewWidth / viewportWidth;
    const sy = viewHeight / viewportHeight;
    l.matrix = new paper.Matrix(sx, 0, 0, sy, 0, 0);
  });
}
