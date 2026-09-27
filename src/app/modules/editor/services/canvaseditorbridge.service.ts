import type {
  CanvasEditorCommand,
  CanvasEditorCommands,
  CanvasEditorMenuState,
  PointCommand,
  PointEditState,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
import type { Path } from 'app/modules/editor/model/paths';
import type { Point } from 'app/modules/editor/scripts/common';

/** What the bridge shows React, through useSyncExternalStore. */
export interface CanvasEditorBridgeState {
  readonly isAvailable: boolean;
  /** The path whose points are being edited, as the editor last reported it. */
  readonly pointEdit: PointEditState | undefined;
}

const DETACHED: CanvasEditorBridgeState = { isAvailable: false, pointEdit: undefined };

/**
 * Lets the rest of the app, like the context menu and the property inspector, reach the canvas
 * editor while it's loaded. The editor is only downloaded with its feature on
 * (components/canvas/CanvasEditorApi.ts), and it's private to the main canvas's controller, which
 * attaches it here once it's ready and detaches it when the canvas goes away. Everything here does
 * nothing without it, as on the live site.
 *
 * The editor also pushes what it's editing here (reportPointEdit), which the inspector subscribes
 * to, so that it can show the points of the path being edited.
 */
export class CanvasEditorBridgeService {
  private editor: CanvasEditorCommands | undefined;
  private state = DETACHED;
  private readonly listeners = new Set<() => void>();

  attach(editor: CanvasEditorCommands) {
    this.editor = editor;
    this.setState({ isAvailable: true, pointEdit: undefined });
  }

  /** Forgets the editor, unless another one has been attached since. */
  detach(editor: CanvasEditorCommands) {
    if (this.editor === editor) {
      this.editor = undefined;
      this.setState(DETACHED);
    }
  }

  isAvailable() {
    return !!this.editor;
  }

  /**
   * Called by the editor whenever the path it edits, or its point selection, changes, with
   * undefined once it stops. Reports from an editor that isn't attached are ignored.
   */
  reportPointEdit(editor: CanvasEditorCommands, pointEdit: PointEditState | undefined) {
    const current = this.state.pointEdit;
    if (
      editor !== this.editor ||
      current === pointEdit ||
      (current &&
        pointEdit &&
        current.layerId === pointEdit.layerId &&
        current.path === pointEdit.path &&
        areSetsEqual(current.selectedAnchorIds, pointEdit.selectedAnchorIds))
    ) {
      return;
    }
    this.setState({ ...this.state, pointEdit });
  }

  // These are arrow functions so that they can be passed to useSyncExternalStore.
  readonly getState = () => this.state;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** What the editor says for the context menu, or undefined if it isn't loaded. */
  getMenuState(): CanvasEditorMenuState | undefined {
    return this.editor?.getMenuState();
  }

  /** The layer under the point, in viewport coordinates, as the editor sees it. */
  getLayerAt(point: Point) {
    return this.editor?.getLayerAt(point);
  }

  runCommand(command: CanvasEditorCommand) {
    this.editor?.runCommand(command);
  }

  startPointEdit(layerId: string) {
    return !!this.editor?.startPointEdit(layerId);
  }

  stopPointEdit() {
    this.editor?.stopPointEdit();
  }

  setSelectedAnchorIds(layerId: string, anchorIds: ReadonlySet<string>) {
    this.editor?.setSelectedAnchorIds(layerId, anchorIds);
  }

  editPoints(
    layerId: string,
    edit: (path: Path) => { readonly path: Path; readonly selectedAnchorIds?: ReadonlySet<string> },
  ) {
    this.editor?.editPoints(layerId, edit);
  }

  runPointCommand(command: PointCommand) {
    this.editor?.runPointCommand(command);
  }

  private setState(state: CanvasEditorBridgeState) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }
}

function areSetsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  return a.size === b.size && [...a].every(id => b.has(id));
}
