import { AfterViewInit, Directive, ElementRef, HostListener, Input } from '@angular/core';
import { ActionSource } from 'app/model/actionmode';
import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { SvgLoader } from 'app/scripts/import';
import { DestroyableMixin } from 'app/scripts/mixins';
import { PaperUtil, ToolSwitcher } from 'app/scripts/paper';
import { LayerTimelineService, ToolModeService } from 'app/services';
import { State, Store } from 'app/store';
import { SetVectorLayer } from 'app/store/layers/actions';
import { getVectorLayer } from 'app/store/layers/selectors';
import * as $ from 'jquery';
import * as paper from 'paper';
import { Point } from 'paper'; // TODO: figure out why this needs to be imported to prevent breaks?
import { Observable } from 'rxjs/Observable';

import { CanvasLayoutMixin } from './CanvasLayoutMixin';

type Context = CanvasRenderingContext2D;

@Directive({ selector: '[appCanvasPaper]' })
export class CanvasPaperDirective extends CanvasLayoutMixin(DestroyableMixin())
  implements AfterViewInit {
  @Input() actionSource: ActionSource;

  private readonly $canvas: JQuery<HTMLCanvasElement>;

  constructor(
    elementRef: ElementRef,
    private readonly toolModeService: ToolModeService,
    private readonly layerTimelineService: LayerTimelineService,
    private readonly store: Store<State>,
  ) {
    super();
    this.$canvas = $(elementRef.nativeElement) as JQuery<HTMLCanvasElement>;
  }

  ngAfterViewInit() {
    this.toolModeService.setup(this.$canvas.get(0));
    this.registerSubscription(
      this.store.select(getVectorLayer).subscribe(() => {
        this.updatePaper();
      }),
    );
    // TODO: remove this debug code
    const jsonObj = JSON.parse(`{
      "id": "43",
      "name": "playtopause",
      "type": "vector",
      "children": [
        {
          "id": "45",
          "name": "path",
          "type": "path",
          "pathData": "M6,12c0,-3.31371 2.68629,-6 6,-6c3.31371,0 6,2.68629 6,6c0,3.31371 -2.68629,6 -6,6c-3.31371,0 -6,-2.68629 -6,-6z",
          "fillColor": "#000000",
          "strokeWidth": 1
        }
      ]
    }`);
    const vl = new VectorLayer(jsonObj);
    this.store.dispatch(new SetVectorLayer(vl));
  }

  // @Override
  onDimensionsChanged() {
    const { w, h } = this.getViewport();
    paper.view.viewSize = new paper.Size(w * this.cssScale, h * this.cssScale);
    // TODO: the guide layer does not resize properly on browser resize events
    // this.$canvas.attr({ width: w * this.attrScale, height: h * this.attrScale });
    this.$canvas.css({ width: w * this.cssScale, height: h * this.cssScale });
    this.updatePaper();
  }

  private updatePaper() {
    // TODO: make this more efficient
    const vl = this.layerTimelineService.getVectorLayer();
    const rootItem = PaperUtil.fromLayer(vl);
    const scale = this.cssScale;
    paper.project.activeLayer.matrix = new paper.Matrix(scale, 0, 0, scale, 0, 0);
    paper.project.activeLayer.removeChildren();
    paper.project.activeLayer.addChild(rootItem);
  }

  // Called by the CanvasComponent.
  onMouseDown(p: { readonly x: number; readonly y: number }) {}

  // Called by the CanvasComponent.
  onMouseMove(p: { readonly x: number; readonly y: number }) {}

  // Called by the CanvasComponent.
  onMouseUp(point: { readonly x: number; readonly y: number }) {}

  // Called by the CanvasComponent.
  onMouseLeave(point: { readonly x: number; readonly y: number }) {}
}
