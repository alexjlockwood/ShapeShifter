import { Component } from '@angular/core';
import { CanvasComponent } from './canvas/canvas.component';
import { PointListComponent } from './pointlist/pointlist.component';
import { VectorLayer, PathLayer } from './scripts/models';
import * as SvgLoader from './scripts/svgloader';
import { SvgPathData } from './scripts/svgpathdata';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  private startVectorLayer: VectorLayer;
  private previewVectorLayer: VectorLayer;
  private endVectorLayer: VectorLayer;
  private shouldLabelPoints = false;

  private animatePreviewVectorLayer(fraction: number): VectorLayer {
    const animateLayer = layer => {
      if (layer.children) {
        layer.children.forEach(l => animateLayer(l));
        return;
      }
      if (layer instanceof PathLayer) {
        const sl = this.startVectorLayer.findLayerById(layer.id);
        const el = this.endVectorLayer.findLayerById(layer.id);
        if (sl && el && sl instanceof PathLayer && el instanceof PathLayer) {
          if (SvgPathData.arePathsMorphable(sl.pathData, el.pathData)) {
            const newPathData = SvgPathData.interpolatePaths(sl.pathData, el.pathData, fraction);
            if (newPathData) {
              layer.pathData = newPathData;
            }
          }
        }
      }
    };
    animateLayer(this.previewVectorLayer);
    const layer = this.previewVectorLayer;
    return new VectorLayer(
      layer.children,
      layer.id,
      layer.width,
      layer.height,
      layer.alpha);
  }

  onStartSvgTextLoaded(svgText: string) {
    console.log('start', svgText);
    this.startVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.maybeDisplayPreview();
  }

  onEndSvgTextLoaded(svgText: string) {
    console.log('end', svgText);
    this.endVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.maybeDisplayPreview();
  }

  onAnimationFractionChanged(fraction: number) {
    console.log(fraction);
    this.previewVectorLayer = this.animatePreviewVectorLayer(fraction);
  }

  onLabelPointsChanged(shouldLabelPoints: boolean) {
    console.log(shouldLabelPoints);
    this.shouldLabelPoints = shouldLabelPoints;
  }

  maybeDisplayPreview() {
    if (this.shouldDisplayCanvases()) {
      this.previewVectorLayer = this.startVectorLayer.clone();
    }
  }

  shouldDisplayCanvases() {
    return this.startVectorLayer && this.endVectorLayer;
  }
}
