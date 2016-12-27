import { Component, OnInit } from '@angular/core';
import { StateService } from './../state.service';
import { VectorLayer, PathLayer } from './../scripts/models';


@Component({
  selector: 'app-pointlist',
  templateUrl: './pointlist.component.html',
  styleUrls: ['./pointlist.component.scss']
})
export class PointListComponent {
  private commands: string[] = [];
  private vectorLayer_: VectorLayer;

  constructor() { }

  get vectorLayer() {
    return this.vectorLayer_;
  }

  set vectorLayer(vectorLayer: VectorLayer) {
    this.vectorLayer_ = vectorLayer;
    this.drawPointList();
  }

  // TODO(alockwood): this only works with SVGs that have a single PathLayer child right now
  private drawPointList() {
    const pathLayer = this.vectorLayer.children[0];
    if (pathLayer instanceof PathLayer) {
      this.commands = pathLayer.pathData.commands.map(c => {
        return c.command + ' ' + c.points.toString();
      });
    }
  }
}
