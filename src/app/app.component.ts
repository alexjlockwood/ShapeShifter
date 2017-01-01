import { Component, OnInit } from '@angular/core';
import { Layer, VectorLayer, GroupLayer, PathLayer } from './scripts/models';
import * as SvgLoader from './scripts/svgloader';
import { SvgPathData } from './scripts/svgpathdata';
import { Command } from './scripts/svgcommands';


const debugMode = true;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private startVectorLayer: VectorLayer;
  private previewVectorLayer: VectorLayer;
  private endVectorLayer: VectorLayer;
  private selectedCommands: Command[] = [];
  private isPathMorphable = true;
  private shouldLabelPoints = true;
  private areVectorLayersCompatible = false;

  ngOnInit() {
    if (debugMode) {
      this.initDebugMode();
    }
  }

  onStartSvgTextLoaded(svgText: string) {
    this.startVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.maybeDisplayPreview();
  }

  onEndSvgTextLoaded(svgText: string) {
    this.endVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.maybeDisplayPreview();
  }

  private maybeDisplayPreview() {
    if (this.startVectorLayer && this.endVectorLayer) {
      this.areVectorLayersCompatible = this.startVectorLayer.isStructurallyIdenticalWith(this.endVectorLayer);
      if (this.areVectorLayersCompatible) {
        console.log('vector layer structures are identical');
      } else {
        console.warn('vector layer structures are not identical');
      }
    }
    if (this.shouldDisplayCanvases()) {
      this.isPathMorphable = this.startVectorLayer.isMorphableWith(this.endVectorLayer);
      this.previewVectorLayer = this.startVectorLayer.deepCopy();
    }
  }

  shouldDisplayCanvases() {
    return this.startVectorLayer && this.endVectorLayer && this.areVectorLayersCompatible;
  }

  onLabelPointsChanged(shouldLabelPoints: boolean) {
    this.shouldLabelPoints = shouldLabelPoints;
  }

  onAnimationFractionChanged(fraction: number) {
    this.previewVectorLayer = this.animatePreviewVectorLayer(fraction);
  }

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
    return Object.create(this.previewVectorLayer);
  }

  onSelectedCommandsChanged(selectedCommands: Command[]) {
    if (!this.isPathMorphable) {
      return;
    }
    // TODO(alockwood): avoid change detection if selected commands hasn't changed
    this.selectedCommands = selectedCommands;
  }

  private initDebugMode() {
    this.onStartSvgTextLoaded(`
      <svg xmlns="http://www.w3.org/2000/svg"
        width="24px"
        height="24px"
        viewBox="0 0 24 24">
        <path d="M 5 11 L 11 11 L 11 5 L 13 5 L 13 11 L 19 11 L 19 13 L 13 13 L 13 19 L 11 19 L 11 13 L 5 13 Z"
          fill="#000" />
      </svg>
      `);
    this.onEndSvgTextLoaded(`
      <svg xmlns="http://www.w3.org/2000/svg"
        width="24px"
        height="24px"
        viewBox="0 0 24 24">
        <path d="M 19 11 L 5 11 L 5 13 L 19 13 Z"
          fill="#000" />
      </svg>
      `);
  }
}
