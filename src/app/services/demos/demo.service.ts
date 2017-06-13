import 'rxjs/add/operator/toPromise';

import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { ModelUtil } from 'app/scripts/common';
import { VectorLayer } from 'app/scripts/model/layers';
import { Animation } from 'app/scripts/model/timeline';

// TODO: store hidden layer IDs and vector layer inside the animations?
interface Demo {
  readonly vectorLayer: VectorLayer;
  readonly animation: Animation;
  readonly hiddenLayerIds: Set<string>;
}

@Injectable()
export class DemoService {

  constructor(private readonly http: Http) { }

  /**
   * Fetches a demo via HTTP.
   * @param demoName the id of the demo (i.e. 'searchtoclose' or 'visibilitystrike')
   */
  getDemo(demoId: string): Promise<Demo> {
    return this.http.get(`demos/${demoId}.shapeshifter`)
      .toPromise()
      .then(response => {
        const jsonObj = response.json();
        const vectorLayer = new VectorLayer(jsonObj.vectorLayer);
        const animation = new Animation(jsonObj.animation);
        const hiddenLayerIds = new Set<string>(jsonObj.hiddenLayerIds);
        return ModelUtil.regenerateModelIds(vectorLayer, animation, hiddenLayerIds) as Demo;
      });
  }
}
