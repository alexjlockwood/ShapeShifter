export { ToolSwitcher } from './ToolSwitcher';

import * as paper from 'paper';

import * as Guides from './util/Guides';
import * as Layers from './util/Layers';

const MAIN_LAYER_NAME = 'mainLayer';

let isPaperJsSetup = false;

export const PaperUtil = {
  setup: (canvas: HTMLCanvasElement) => {
    if (isPaperJsSetup) {
      return;
    }
    paper.setup(canvas);
    paper.settings.handleSize = 8;
    const mainLayer = createMainLayer();
    paper.project.addLayer(mainLayer);
    const guideLayer = Guides.createGuideLayer();
    paper.project.addLayer(guideLayer);
    mainLayer.activate();
    isPaperJsSetup = true;
  },
  fromLayer: Layers.fromLayer,
};

function createMainLayer() {
  const mainLayer = new paper.Layer();
  mainLayer.remove();
  mainLayer.name = MAIN_LAYER_NAME;
  return mainLayer;
}
