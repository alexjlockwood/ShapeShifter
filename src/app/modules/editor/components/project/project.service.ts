import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { VectorLayer } from 'app/modules/editor/model/layers';
import { Animation } from 'app/modules/editor/model/timeline';
import { ModelUtil } from 'app/modules/editor/scripts/common';
import { FileExportService } from 'app/modules/editor/services/fileexport.service';

// TODO: store hidden layer IDs and vector layer inside the animations?
interface Project {
  readonly vectorLayer: VectorLayer;
  readonly animation: Animation;
  readonly hiddenLayerIds: ReadonlySet<string>;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private readonly http: HttpClient) {}

  /**
   * Fetches a shape shifter project via HTTP.
   * @param url the URL of the shape shifter project
   */
  getProject(url: string): Promise<Project> {
    return this.http
      .get(url)
      .toPromise()
      .then(response => {
        const jsonObj = response;
        const { vectorLayer, animation, hiddenLayerIds } = FileExportService.fromJSON(jsonObj);
        return ModelUtil.regenerateModelIds(vectorLayer, animation, hiddenLayerIds) as Project;
      });
  }
}
