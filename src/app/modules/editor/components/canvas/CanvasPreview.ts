import { ClipPathLayer, LayerUtil, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation } from 'app/modules/editor/model/timeline';
import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import { LayerTimelineService } from 'app/modules/editor/services';
import { State, Store } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getCurrentTime, getIsPlaying } from 'app/modules/editor/store/playback/selectors';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import { combineLatest, Subject, Subscription } from 'rxjs';

/** The layers and their animation, which an edit changes together. */
export interface CanvasDocument {
  readonly vectorLayer: VectorLayer;
  readonly animation: Animation;
}

interface Edit {
  // The document the edit started from.
  readonly base: CanvasDocument;
  readonly currentTime: number;
  readonly onCancel: (() => void) | undefined;
}

interface WorkingCopy {
  readonly document: CanvasDocument;
  readonly renderer: AnimationRenderer;
  // What to select when the edit is committed, e.g. the layers it duplicated.
  readonly selectedLayerIds: ReadonlySet<string> | undefined;
}

/**
 * Shows an edit on the canvas while a gesture makes it, without changing the store on every
 * pointer move, which would rebuild the animation renderer each time and record many undo steps.
 * The gesture keeps a working copy of the document, which the main canvas draws at the current
 * time, and commits it when it ends, as one undo step. Anything else that changes the document or
 * the time cancels it, since the copy was made from a document that's gone: e.g. undo, deleting the
 * layer, or playback.
 *
 * Changing a path that an animation block sets at the current time wouldn't show, so setPath
 * refuses to. Editing the block's value comes later (docs/canvas-editor.md, phase 5).
 */
export class CanvasPreview {
  private edit: Edit | undefined;
  private working: WorkingCopy | undefined;
  // Changes with the working copy. The canvas redraws when it does.
  private version = 0;
  private readonly changes = new Subject<void>();
  private memo: { currentTime: number; version: number; result: VectorLayer } | undefined;
  private subscription: Subscription | undefined;

  constructor(
    private readonly store: Store<State>,
    private readonly layerTimelineService: LayerTimelineService,
  ) {}

  init() {
    this.subscription = combineLatest([
      this.store.select(getVectorLayer),
      this.store.select(getAnimation),
      this.store.select(getCurrentTime),
      this.store.select(getIsPlaying),
    ]).subscribe(([vectorLayer, animation, currentTime, isPlaying]) => {
      const { edit } = this;
      if (
        edit &&
        (vectorLayer !== edit.base.vectorLayer ||
          animation !== edit.base.animation ||
          currentTime !== edit.currentTime ||
          isPlaying)
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
    const state = this.store.getState();
    this.edit = {
      base: { vectorLayer: getVectorLayer(state), animation: getAnimation(state) },
      currentTime: getCurrentTime(state),
      onCancel,
    };
  }

  /** The document the edit started from, which gestures change from scratch on every move. */
  getBase() {
    return this.edit?.base;
  }

  /**
   * Shows the document as the edit's working copy. When it's committed, the selection changes to
   * selectedLayerIds, if they're given.
   */
  setDocument(document: CanvasDocument, selectedLayerIds?: ReadonlySet<string>) {
    if (!this.edit) {
      throw new Error('Begin an edit before changing the document');
    }
    this.working = {
      document,
      renderer: new AnimationRenderer(document.vectorLayer, document.animation),
      selectedLayerIds,
    };
    this.changed();
  }

  /**
   * Returns whether the layer's path can be edited: it's a path layer, and no animation block sets
   * its path at the current time. Blocks set the path from the time that the first one starts.
   */
  canEditPath(layerId: string) {
    const state = this.store.getState();
    const layer = getVectorLayer(state).findLayerById(layerId);
    const currentTime = getCurrentTime(state);
    return (
      (layer instanceof PathLayer || layer instanceof ClipPathLayer) &&
      !getAnimation(state).blocks.some(
        b => b.layerId === layerId && b.propertyName === 'pathData' && b.startTime <= currentTime,
      )
    );
  }

  /** Shows the layer with a working copy of its path. */
  setPath(layerId: string, path: Path) {
    const { edit } = this;
    if (!edit) {
      throw new Error('Begin an edit before changing paths');
    }
    if (!this.canEditPath(layerId)) {
      throw new Error("The layer's path can't be edited at this time");
    }
    const { vectorLayer, animation } = this.working?.document ?? edit.base;
    const layer = vectorLayer.findLayerById(layerId) as PathLayer | ClipPathLayer;
    const clone = layer.clone();
    clone.pathData = path;
    this.setDocument({
      vectorLayer: LayerUtil.replaceLayer(vectorLayer, layerId, clone),
      animation,
    });
  }

  /** Saves the working copy as one undo step, and ends the edit. */
  commit() {
    const { edit, working } = this;
    if (!edit) {
      return;
    }
    // Before saving, so that the new document doesn't cancel the edit.
    this.end();
    if (!working) {
      return;
    }
    const { document, selectedLayerIds } = working;
    if (
      document.vectorLayer !== edit.base.vectorLayer ||
      document.animation !== edit.base.animation
    ) {
      this.layerTimelineService.commitCanvasEdit(
        document.vectorLayer,
        document.animation,
        selectedLayerIds,
      );
    }
  }

  /** Throws the working copy away, and ends the edit. */
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
    if (this.working) {
      this.working = undefined;
      this.changed();
    }
  }

  private changed() {
    this.version++;
    this.memo = undefined;
    this.changes.next();
  }

  asObservable() {
    return this.changes.asObservable();
  }

  /**
   * Returns the working copy as it's drawn at the time, or the rendered vector layer if there's no
   * working copy.
   */
  apply(vl: VectorLayer, currentTime: number) {
    const { working, memo, version } = this;
    if (!working) {
      return vl;
    }
    if (memo && memo.currentTime === currentTime && memo.version === version) {
      return memo.result;
    }
    const result = working.renderer.setCurrentTime(currentTime);
    this.memo = { currentTime, version, result };
    return result;
  }
}
