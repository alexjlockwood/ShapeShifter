import * as _ from 'lodash';
import { CanvasType } from '../../CanvasType';
import { SvgLoader } from '../import';
import { StateService } from '../../services';

export function loadDemo(lss: StateService, selectedSvgString: string) {
  const importedVectorLayer = SvgLoader.loadVectorLayerFromSvgString(selectedSvgString, []);
  lss.addVectorLayers([importedVectorLayer], false);
  const shuffledAvailableIds = _.shuffle(lss.getExistingPathIds().slice());
  // Set the preview layer id before the start/end layer id to ensure
  // that auto-conversion runs properly.
  lss.setActivePathIds([
    { type: CanvasType.Preview, pathId: shuffledAvailableIds[0] },
    { type: CanvasType.Start, pathId: shuffledAvailableIds[0] },
    { type: CanvasType.End, pathId: shuffledAvailableIds[1] },
  ]);
}
