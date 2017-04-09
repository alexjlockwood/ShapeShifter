import * as _ from 'lodash';
import { CanvasType } from '../../CanvasType';
import { SvgLoader } from '../import';
import { StateService } from '../../services';
import { PathLayer, LayerUtil } from '../layers';

export function loadDemo(lss: StateService, selectedSvgString: string) {
  const importedVectorLayer = SvgLoader.loadVectorLayerFromSvgString(selectedSvgString, []);
  lss.addVectorLayers([importedVectorLayer], false /* shouldNotify */);
  const shuffledAvailableIds =
    _.shuffle(LayerUtil.getAllIds([importedVectorLayer], l => l instanceof PathLayer));
  lss.setActivePathId(CanvasType.Start, shuffledAvailableIds[0], true /* shouldNotify */);
  lss.setActivePathId(CanvasType.End, shuffledAvailableIds[1], true /* shouldNotify */);
}
