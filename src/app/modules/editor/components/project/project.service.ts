import { VectorLayer } from 'app/modules/editor/model/layers';
import { Animation } from 'app/modules/editor/model/timeline';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import { FileExportService } from 'app/modules/editor/services/fileexport.service';

// TODO: store hidden layer IDs and vector layer inside the animations?
interface Project {
  readonly vectorLayer: VectorLayer;
  readonly animation: Animation;
  readonly hiddenLayerIds: ReadonlySet<string>;
}

export class ProjectService {
  /**
   * Fetches a shape shifter project via HTTP.
   * @param url the URL of the shape shifter project
   */
  async getProject(url: string, signal?: AbortSignal): Promise<Project> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url} (${response.status})`);
    }
    const jsonObj = await response.json();
    const { vectorLayer, animation, hiddenLayerIds } = FileExportService.fromJSON(jsonObj);
    return ModelUtil.regenerateModelIds(vectorLayer, animation, hiddenLayerIds) as Project;
  }
}
