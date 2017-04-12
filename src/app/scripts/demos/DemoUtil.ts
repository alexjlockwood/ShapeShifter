import * as _ from 'lodash';
import { CanvasType } from '../../CanvasType';
import { SvgLoader } from '../import';
import { StateService } from '../../services';
import { PathLayer, LayerUtil, VectorLayer } from '../layers';

export function loadDemo(lss: StateService, selectedSvgStrings: ReadonlyArray<string>) {
  const currentIds: string[] = [];
  const vls: VectorLayer[] = [];
  for (const svg of selectedSvgStrings) {
    const vl = SvgLoader.loadVectorLayerFromSvgString(svg, currentIds);
    vls.push(vl);
    currentIds.push(...LayerUtil.getAllIds([vl]));
  }
  lss.addVectorLayers(vls, false /* shouldNotify */);
  const shuffledAvailableIds = _.shuffle(LayerUtil.getAllIds(vls, l => l instanceof PathLayer));
  lss.setActivePathId(CanvasType.Start, shuffledAvailableIds[0], true /* shouldNotify */);
  lss.setActivePathId(CanvasType.End, shuffledAvailableIds[1], true /* shouldNotify */);
}
