import type {
  CanvasEditorCommand,
  CanvasEditorCommands,
  CanvasEditorMenuState,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
import type { Point } from 'app/modules/editor/scripts/common';

/**
 * Lets the rest of the app, like the context menu, reach the canvas editor while it's loaded. The
 * editor is only downloaded with its feature on (components/canvas/CanvasEditorApi.ts), and it's
 * private to the main canvas's controller, which attaches it here once it's ready and detaches it
 * when the canvas goes away. Everything here does nothing without it, as on the live site.
 */
export class CanvasEditorBridgeService {
  private editor: CanvasEditorCommands | undefined;

  attach(editor: CanvasEditorCommands) {
    this.editor = editor;
  }

  /** Forgets the editor, unless another one has been attached since. */
  detach(editor: CanvasEditorCommands) {
    if (this.editor === editor) {
      this.editor = undefined;
    }
  }

  isAvailable() {
    return !!this.editor;
  }

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
}
