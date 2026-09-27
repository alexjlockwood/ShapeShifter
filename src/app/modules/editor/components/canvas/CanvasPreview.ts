import {
  ClipPathLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { LayerTimelineService } from 'app/modules/editor/services';
import { State, Store } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getCurrentTime, getIsPlaying } from 'app/modules/editor/store/playback/selectors';
import { combineLatest, Subject, Subscription } from 'rxjs';

interface Edit {
  // The document the edit started from, which it's saved to.
  readonly vectorLayer: VectorLayer;
  readonly currentTime: number;
  readonly onCancel: (() => void) | undefined;
}

/**
 * Shows an edit on the canvas while a gesture makes it, without changing the store on every
 * pointer move, which would rebuild the animation renderer each time and record many undo steps.
 * The gesture keeps working copies of the paths it changes, and commits them when it ends, as one
 * undo step. Anything else that changes the document or the time cancels it, since the copies were
 * made from a document that's gone: e.g. undo, deleting the layer, or playback.
 */
export class CanvasPreview {
  private edit: Edit | undefined;
  private readonly paths = new Map<string, Path>();
  // Changes with the paths. The canvas redraws when it does.
  private version = 0;
  private readonly changes = new Subject<void>();
  private memo:
    { vl: VectorLayer; currentTime: number; version: number; result: VectorLayer } | undefined;
  private subscription: Subscription | undefined;

  constructor(
    private readonly store: Store<State>,
    private readonly layerTimelineService: LayerTimelineService,
  ) {}

  init() {
    this.subscription = combineLatest([
      this.store.select(getVectorLayer),
      this.store.select(getCurrentTime),
      this.store.select(getIsPlaying),
    ]).subscribe(([vectorLayer, currentTime, isPlaying]) => {
      const { edit } = this;
      if (
        edit &&
        (vectorLayer !== edit.vectorLayer || currentTime !== edit.currentTime || isPlaying)
      ) {
        this.cancel();
      }
    });
  }

  dispose() {
    this.subscription?.unsubscribe();
    this.cancel();
  }

  isEditing() {
    return !!this.edit;
  }

  /**
   * Starts an edit from the document as it is now, replacing one that's in progress. onCancel is
   * called if something else cancels it.
   */
  begin(onCancel?: () => void) {
    this.cancel();
    this.edit = {
      vectorLayer: getVectorLayer(this.store.getState()),
      currentTime: getCurrentTime(this.store.getState()),
      onCancel,
    };
  }

  /** Shows the layer with a working copy of its path. */
  setPath(layerId: string, path: Path) {
    if (!this.edit) {
      throw new Error('Begin an edit before changing paths');
    }
    this.paths.set(layerId, path);
    this.changed();
  }

  /** Saves the working copies as one undo step, and ends the edit. */
  commit() {
    const { edit } = this;
    if (!edit) {
      return;
    }
    let vl = edit.vectorLayer;
    for (const [layerId, path] of this.paths) {
      const layer = vl.findLayerById(layerId);
      if (layer instanceof PathLayer || layer instanceof ClipPathLayer) {
        const clone = layer.clone();
        clone.pathData = path;
        vl = LayerUtil.replaceLayer(vl, layerId, clone);
      }
    }
    // Before saving, so that the new document doesn't cancel the edit.
    this.end();
    if (vl !== edit.vectorLayer) {
      this.layerTimelineService.commitCanvasEdit(vl);
    }
  }

  /** Throws the working copies away, and ends the edit. */
  cancel() {
    const { edit } = this;
    if (!edit) {
      return;
    }
    this.end();
    edit.onCancel?.();
  }

  private end() {
    this.edit = undefined;
    if (this.paths.size) {
      this.paths.clear();
      this.changed();
    }
  }

  private changed() {
    this.version++;
    this.changes.next();
  }

  asObservable() {
    return this.changes.asObservable();
  }

  /**
   * Returns the rendered vector layer with the working copies of its paths, or the layer itself if
   * there are none. The animation renderer changes the rendered layer in place as the time
   * changes, so the result is remembered by the time as well as by the layer.
   */
  apply(vl: VectorLayer, currentTime: number) {
    if (!this.paths.size) {
      return vl;
    }
    const { memo, version } = this;
    if (memo && memo.vl === vl && memo.currentTime === currentTime && memo.version === version) {
      return memo.result;
    }
    const { paths } = this;
    // Clones the layers with new paths and their ancestors, in one pass over the tree.
    const recurseFn = (layer: Layer): Layer => {
      const path = paths.get(layer.id);
      const children = layer.children.map(recurseFn);
      if (!path && children.every((child, i) => child === layer.children[i])) {
        return layer;
      }
      const clone = layer.clone();
      clone.children = children;
      if (path && (clone instanceof PathLayer || clone instanceof ClipPathLayer)) {
        clone.pathData = path;
      }
      return clone;
    };
    const result = recurseFn(vl) as VectorLayer;
    this.memo = { vl, currentTime, version, result };
    return result;
  }
}
