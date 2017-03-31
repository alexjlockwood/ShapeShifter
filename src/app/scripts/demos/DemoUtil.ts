import * as _ from 'lodash';
import { CanvasType } from '../../CanvasType';
import { SvgLoader } from '../import';
import { PathLayer } from '../layers';
import { StateService } from '../../services';

export function loadDemo(lss: StateService, selectedSvgStrings: { start: string, end: string }) {
  const importedStartVectorLayer = SvgLoader.loadVectorLayerFromSvgString(selectedSvgStrings.start);
  const importedEndVectorLayer = SvgLoader.loadVectorLayerFromSvgString(selectedSvgStrings.end);
  lss.setVectorLayer(CanvasType.Start, importedStartVectorLayer.clone(), false);
  lss.setVectorLayer(CanvasType.Preview, importedStartVectorLayer.clone(), false);
  lss.setVectorLayer(CanvasType.End, importedEndVectorLayer.clone(), false);
  const availableStartPathIds: string[] = [];
  importedStartVectorLayer.walk((layer => {
    if (layer instanceof PathLayer) {
      availableStartPathIds.push(layer.id);
    }
  }));
  const availableEndPathIds: string[] = [];
  importedEndVectorLayer.walk((layer => {
    if (layer instanceof PathLayer) {
      availableEndPathIds.push(layer.id);
    }
  }));
  const shuffledStartPathIds = _.shuffle(availableStartPathIds);
  const shuffledEndPathIds = _.shuffle(availableEndPathIds);
  lss.setActivePathIds([
    { type: CanvasType.Preview, pathId: shuffledStartPathIds[0] },
    { type: CanvasType.Start, pathId: shuffledStartPathIds[0] },
    { type: CanvasType.End, pathId: shuffledEndPathIds[0] },
  ]);
}
