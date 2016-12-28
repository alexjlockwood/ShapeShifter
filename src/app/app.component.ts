import { Component, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CanvasComponent } from './canvas/canvas.component';
import { PointListComponent } from './pointlist/pointlist.component';
import { StateService } from './state.service';
import { Subscription } from 'rxjs/Subscription';
import { VectorLayer, PathLayer } from './scripts/models';
import * as SvgLoader from './scripts/svgloader';
import { SvgPathData } from './scripts/svgpathdata';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('startCanvas') private startCanvas: CanvasComponent;
  @ViewChild('previewCanvas') private previewCanvas: CanvasComponent;
  @ViewChild('endCanvas') private endCanvas: CanvasComponent;
  @ViewChild('startPointList') private startPointList: PointListComponent;
  @ViewChild('previewPointList') private previewPointList: PointListComponent;
  @ViewChild('endPointList') private endPointList: PointListComponent;
  private startVectorLayer: VectorLayer;
  private previewVectorLayer: VectorLayer;
  private endVectorLayer: VectorLayer;
  private subscriptions: Subscription[] = [];

  constructor(private stateService: StateService) { }

  ngAfterViewInit() {
    const startSvgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24">
        <path d="M 0 0 C 9.6 0 4.8 24 24 24" stroke="#000" stroke-width="1"/>
      </svg>`;
    this.startVectorLayer = SvgLoader.loadVectorLayerFromSvgString(startSvgString);
    this.startCanvas.vectorLayer = this.startVectorLayer;

    const endSvgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24">
        <path d="M 0 24 C 0 4.8 9.6 0 24 0" stroke="#000" stroke-width="1"/>
      </svg>`;
    this.endVectorLayer = SvgLoader.loadVectorLayerFromSvgString(endSvgString);
    this.endCanvas.vectorLayer = this.endVectorLayer;

    this.previewVectorLayer = this.startVectorLayer.clone();
    this.previewCanvas.vectorLayer = this.previewVectorLayer;

    this.subscriptions.push(
      this.stateService.getShouldLabelPointsChangedSubscription(
        shouldLabelPoints => {
          this.startCanvas.shouldLabelPoints = shouldLabelPoints;
          this.previewCanvas.shouldLabelPoints = shouldLabelPoints;
          this.endCanvas.shouldLabelPoints = shouldLabelPoints;
        }));

    this.subscriptions.push(
      this.stateService.getAnimationFractionChangedSubscription(
        animationFraction => {
          this.animatePreviewVectorLayer(animationFraction);
          this.previewCanvas.vectorLayer = this.previewVectorLayer;
          this.previewPointList.vectorLayer = this.previewVectorLayer;
        }));

    // TODO(alockwood): try to find a less hacky way to do this...? the app crashes otherwise...
    setTimeout(() => {
      this.startPointList.vectorLayer = this.startVectorLayer;
      this.previewPointList.vectorLayer = this.previewVectorLayer;
      this.endPointList.vectorLayer = this.endVectorLayer;
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private animatePreviewVectorLayer(fraction: number) {
    const animateLayer = layer => {
      if (layer.children) {
        layer.children.forEach(l => animateLayer(l));
        return;
      }
      if (layer instanceof PathLayer) {
        const sl = this.startVectorLayer.findLayerById(layer.id);
        const el = this.endVectorLayer.findLayerById(layer.id);
        if (sl && el && sl instanceof PathLayer && el instanceof PathLayer) {
          const newPathData = SvgPathData.interpolate(sl.pathData, el.pathData, fraction);
          if (newPathData) {
            layer.pathData = newPathData;
          }
        }
      }
    };
    animateLayer(this.previewVectorLayer);
  }
}
