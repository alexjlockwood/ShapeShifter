import * as paper from 'paper';

import * as Guides from './util/Guides';
import * as Layers from './util/Layers';

let isPaperJsSetup = false;

export const PaperUtil = {
  setup: (canvas: HTMLCanvasElement) => {
    if (isPaperJsSetup) {
      return;
    }
    paper.setup(canvas);
    paper.settings.handleSize = 8;
    const mainLayer = new paper.Layer({ name: 'mainLayer' });
    paper.project.addLayer(mainLayer);
    paper.project.addLayer(Guides.createGuideLayer());
    mainLayer.activate();
    isPaperJsSetup = true;
  },
  fromVectorLayer: Layers.fromVectorLayer,
};

export { ToolSwitcher } from './ToolSwitcher';
