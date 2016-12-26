import { Component, OnInit } from '@angular/core';
import { StateService } from './../state.service';
import { PathLayer } from './../scripts/models';

@Component({
  selector: 'app-pointlist',
  templateUrl: './pointlist.component.html',
  styleUrls: ['./pointlist.component.scss']
})
export class PointListComponent implements OnInit {
  private commands: string[] = [];

  constructor(private stateService: StateService) {
    const vectorLayer = stateService.startVectorLayer;
    const pathLayer = vectorLayer.children[0];
    if (pathLayer instanceof PathLayer) {
      this.commands = pathLayer.pathData.commands.map(c => {
        return c.command + ' ' + c.points.toString();
      });
    }
  }

  ngOnInit() {
  }

}
