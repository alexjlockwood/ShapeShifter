import { Animation } from '../animations';
import { VectorLayer } from '../layers';

export interface AppState {
  animations: ReadonlyArray<Animation>;
  vectorLayers: ReadonlyArray<VectorLayer>;
}
