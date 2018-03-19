import { AfterViewInit, Directive, ElementRef, Input, OnDestroy } from '@angular/core';
import { ActionSource } from 'app/model/actionmode';
import { VectorLayer } from 'app/model/layers';
import { DestroyableMixin } from 'app/scripts/mixins';
import { PaperProject } from 'app/scripts/paper';
import { PaperService } from 'app/services';
import { State, Store } from 'app/store';
import { SetVectorLayer } from 'app/store/layers/actions';
import * as $ from 'jquery';

import { CanvasLayoutMixin } from './CanvasLayoutMixin';

@Directive({ selector: '[appCanvasPaper]' })
export class CanvasPaperDirective extends CanvasLayoutMixin(DestroyableMixin())
  implements AfterViewInit, OnDestroy {
  @Input() actionSource: ActionSource;
  private readonly $canvas: JQuery<HTMLCanvasElement>;
  private paperProject: PaperProject;

  constructor(
    elementRef: ElementRef,
    private readonly ps: PaperService,
    private readonly store: Store<State>,
  ) {
    super();
    this.$canvas = $(elementRef.nativeElement) as JQuery<HTMLCanvasElement>;
  }

  ngAfterViewInit() {
    this.paperProject = new PaperProject(this.$canvas.get(0), this.ps);

    // TODO: remove this debug code
    // TODO: explicitly set paths with no Z to closed? (i.e. M 1 1 h 6 v 6 h -6 v -6)
    const jsonObj = JSON.parse(`{
      "id": "1",
      "name": "demo",
      "type": "vector",
      "width": "24",
      "height": "24",
      "children": [
        {
          "id": "2",
          "name": "orange",
          "type": "path",
          "pathData": "M 4 4 C 20 4 20 4 20 20 C 4 20 4 20 4 4 Z",
          "strokeColor": "#000",
          "strokeWidth": "1"
        }
      ]
    }`);
    this.store.dispatch(new SetVectorLayer(new VectorLayer(jsonObj)));
  }

  ngOnDestroy() {
    this.paperProject.remove();
  }

  // @Override
  protected onDimensionsChanged() {
    const { w, h } = this.getViewport();
    const scale = this.cssScale;
    this.$canvas.css({ width: w * scale, height: h * scale });
    this.paperProject.setDimensions(w, h, w * scale, h * scale);
  }
}
