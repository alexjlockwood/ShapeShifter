import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { VectorLayer } from 'app/model/layers';
import { Animation } from 'app/model/timeline';
import { ModelUtil } from 'app/scripts/common';
import { FileExportService } from 'app/services/fileexport.service';

// TODO: store hidden layer IDs and vector layer inside the animations?
interface Demo {
  readonly vectorLayer: VectorLayer;
  readonly animation: Animation;
  readonly hiddenLayerIds: ReadonlySet<string>;
}

@Injectable({ providedIn: 'root' })
export class DemoService {
  constructor(private readonly http: HttpClient) {}

  /**
   * Fetches a demo via HTTP.
   * @param demoName the id of the demo (i.e. 'searchtoclose' or 'visibilitystrike')
   */
  getDemo(demoId: string): Promise<Demo> {
    return this.http
      .get(`demos/${demoId}.shapeshifter`)
      .toPromise()
      .then(response => {
        const jsonObj = response;
        const { vectorLayer, animation, hiddenLayerIds } = FileExportService.fromJSON(jsonObj);
        return ModelUtil.regenerateModelIds(vectorLayer, animation, hiddenLayerIds) as Demo;
      });
  }
}
