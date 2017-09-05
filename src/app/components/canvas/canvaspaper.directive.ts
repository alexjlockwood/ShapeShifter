import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
} from '@angular/core';
import { ActionSource } from 'app/model/actionmode';
import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { SvgLoader } from 'app/scripts/import';
import { DestroyableMixin } from 'app/scripts/mixins';
import { Paper } from 'app/scripts/paper';
import { PaperService } from 'app/services';
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
  implements AfterViewInit, OnDestroy {
  @Input() actionSource: ActionSource;

  private readonly $canvas: JQuery<HTMLCanvasElement>;

  constructor(
    elementRef: ElementRef,
    private readonly paperService: PaperService,
    private readonly store: Store<State>,
  ) {
    super();
    this.$canvas = $(elementRef.nativeElement) as JQuery<HTMLCanvasElement>;
  }

  ngAfterViewInit() {
    Paper.initialize(this.$canvas.get(0), this.paperService);

    // TODO: remove this debug code
    const jsonObj = JSON.parse(`{
      "id": "43",
      "name": "playtopause",
      "type": "vector",
      "children": [
        {
          "id": "102",
          "name": "group",
          "type": "group",
          "pivotX": "12",
          "pivotY": "12",
          "scaleX": "1",
          "scaleY": "1",
          "rotation": "180",
          "children": [
                {
                  "id": "46",
                  "name": "path",
                  "type": "path",
                  "pathData": "M 8 8 h 8 v 8 h -8 v -8",
                  "strokeColor": "#000000",
                  "fillColor": "#f00"
                }
          ]
        }
      ]
    }`);
    // TODO: remove this debug code
    this.store.dispatch(new SetVectorLayer(new VectorLayer(jsonObj)));
  }

  ngOnDestroy() {
    // TODO: support the ability to detach paper.js features? (i.e. Paper.detach(canvas))
  }

  // @Override
  onDimensionsChanged() {
    const { w, h } = this.getViewport();
    const scale = this.cssScale;
    this.$canvas.css({ width: w * scale, height: h * scale });
    Paper.updateProjectDimensions(w, h, w * scale, h * scale);
  }
}
