import { Component, OnInit } from '@angular/core';
import { ToolMode } from 'app/model/toolmode';
import { ToolModeService } from 'app/services';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-toolpanel',
  templateUrl: './toolpanel.component.html',
  styleUrls: ['./toolpanel.component.scss'],
})
export class ToolPanelComponent implements OnInit {
  private readonly TOOL_MODE_SELECT = ToolMode.Select;
  private readonly TOOL_MODE_DIRECT_SELECT = ToolMode.DirectSelect;
  private readonly TOOL_MODE_PEN = ToolMode.Pen;
  private readonly TOOL_MODE_ZOOMPAN = ToolMode.ZoomPan;

  private toolMode$: Observable<ToolMode>;

  constructor(private readonly toolModeService: ToolModeService) {}

  ngOnInit() {
    this.toolMode$ = this.toolModeService.asObservable();
  }

  onSelectClick() {
    this.toolModeService.setToolMode(ToolMode.Select);
  }

  onDirectSelectClick() {
    this.toolModeService.setToolMode(ToolMode.DirectSelect);
  }

  onPenClick() {
    this.toolModeService.setToolMode(ToolMode.Pen);
  }

  onZoomPanClick() {
    this.toolModeService.setToolMode(ToolMode.ZoomPan);
  }
}
