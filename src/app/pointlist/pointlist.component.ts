import { Component, OnInit } from '@angular/core';
import { StateService } from './../state.service';
import { VectorLayer, PathLayer } from './../scripts/models';
import { DragulaService } from 'ng2-dragula';

@Component({
  selector: 'app-pointlist',
  templateUrl: './pointlist.component.html',
  styleUrls: ['./pointlist.component.scss']
})
export class PointListComponent {
  private commands: string[] = [];
  private vectorLayer_: VectorLayer;

  constructor(private dragulaService: DragulaService) {
    dragulaService.drag.subscribe((value) => {
      console.log(`drag: ${value[0]}`);
      this.onDrag(value.slice(1));
    });
    dragulaService.drop.subscribe((value) => {
      console.log(`drop: ${value[0]}`);
      this.onDrop(value.slice(1));
    });
    dragulaService.over.subscribe((value) => {
      console.log(`over: ${value[0]}`);
      this.onOver(value.slice(1));
    });
    dragulaService.out.subscribe((value) => {
      console.log(`out: ${value[0]}`);
      this.onOut(value.slice(1));
    });
  }

  private onDrag(args) {
    let [e, el] = args;
    // do something
    //console.log(e, el);
  }

  private onDrop(args) {
    let [e, el] = args;
    // do something
    //console.log(e, el);
  }

  private onOver(args) {
    let [e, el, container] = args;
    // do something
    //console.log(e, el);
  }

  private onOut(args) {
    let [e, el, container] = args;
    // do something
    //console.log(e, el);
  }

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
