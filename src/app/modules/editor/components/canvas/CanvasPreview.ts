import { VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation } from 'app/modules/editor/model/timeline';
import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import { LayerTimelineService } from 'app/modules/editor/services';
import { State, Store } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getCurrentTime, getIsPlaying } from 'app/modules/editor/store/playback/selectors';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import { combineLatest, Subject, Subscription } from 'rxjs';

import { getPathKeyframe, setKeyframePath } from './pathKeyframes';

/** The layers and their animation, which an edit changes together. */
export interface CanvasDocument {
  readonly vectorLayer: VectorLayer;
  readonly animation: Animation;
}

/** The layer states that a committed edit changes too, e.g. to select the layers it duplicated. */
export interface CanvasEditLayerIds {
  readonly selectedLayerIds?: ReadonlySet<string>;
  readonly hiddenLayerIds?: ReadonlySet<string>;
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
  readonly layerIds: CanvasEditLayerIds | undefined;
}

/**
 * Shows an edit on the canvas while a gesture makes it, without changing the store on every
 * pointer move, which would rebuild the animation renderer each time and record many undo steps.
 * The gesture keeps a working copy of the document, which the main canvas draws at the current
 * time, and commits it when it ends, as one undo step. Anything else that changes the document or
 * the time cancels it, since the copy was made from a document that's gone: e.g. undo, deleting the
 * layer, or playback.
 *
 * A path that an animation block sets at the current time is edited where its keyframe is saved:
 * the block's start or end, at those times or while the path holds still between blocks, and
 * nowhere while it's morphing (see pathKeyframes.ts).
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
   * Shows the document as the edit's working copy. When it's committed, the selected and hidden
   * layers change to layerIds' sets, if they're given.
   */
  setDocument(document: CanvasDocument, layerIds?: CanvasEditLayerIds) {
    if (!this.edit) {
      throw new Error('Begin an edit before changing the document');
    }
    this.working = {
      document,
      renderer: new AnimationRenderer(document.vectorLayer, document.animation),
      layerIds,
    };
    this.changed();
  }

  /** The document with the working copy in it, if there is one. */
  getDocument(): CanvasDocument {
    return this.working?.document ?? this.getStoreDocument();
  }

  /**
   * Returns whether the layer's path can be edited: it's a path layer, and it isn't in the middle
   * of morphing at the current time.
   */
  canEditPath(layerId: string) {
    const keyframe = getPathKeyframe(
      this.getStoreDocument(),
      layerId,
      getCurrentTime(this.store.getState()),
    );
    return !!keyframe && keyframe.type !== 'between' && !!keyframe.path;
  }

  /**
   * Returns the layer's path in the edit's base, at the current time: the one that gestures change,
   * which is a path block's value if one sets it.
   */
  getBasePath(layerId: string) {
    const { edit } = this;
    const keyframe = edit && getPathKeyframe(edit.base, layerId, edit.currentTime);
    return keyframe && keyframe.type !== 'between' ? keyframe.path : undefined;
  }

  /** Shows the layer with a working copy of its path, where its keyframe is saved. */
  setPath(layerId: string, path: Path) {
    const { edit } = this;
    if (!edit) {
      throw new Error('Begin an edit before changing paths');
    }
    // What the edit changes is decided by the document it started from, e.g. so that a path that
    // was the same at both ends of a hold stays that way.
    const keyframe = getPathKeyframe(edit.base, layerId, edit.currentTime);
    if (!keyframe || keyframe.type === 'between') {
      throw new Error("The layer's path can't be edited at this time");
    }
    const targets = keyframe.type === 'static' ? [{ kind: 'base' as const }] : keyframe.targets;
    this.setDocument(setKeyframePath(this.working?.document ?? edit.base, layerId, targets, path));
  }

  /** The document as it's saved, without the working copy. */
  getStoreDocument(): CanvasDocument {
    const state = this.store.getState();
    return { vectorLayer: getVectorLayer(state), animation: getAnimation(state) };
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
    const { document, layerIds } = working;
    if (
      document.vectorLayer !== edit.base.vectorLayer ||
      document.animation !== edit.base.animation
    ) {
      this.layerTimelineService.commitCanvasEdit(
        document.vectorLayer,
        document.animation,
        layerIds,
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
