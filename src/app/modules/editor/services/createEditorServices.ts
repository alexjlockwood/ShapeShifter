import { ContextMenuService } from 'app/modules/editor/components/contextmenu/contextmenu.service';
import { DialogService } from 'app/modules/editor/components/dialogs/dialog.service';
import { ProjectService } from 'app/modules/editor/components/project/project.service';
import type { State, Store } from 'app/modules/editor/store';
import { Features, NO_FEATURES } from 'environments/features';

import { ActionModeService } from './actionmode.service';
import { CanvasEditorBridgeService } from './canvaseditorbridge.service';
import { CanvasSettingsService } from './canvassettings.service';
import { CanvasViewportService } from './canvasviewport.service';
import { ClipboardService } from './clipboard.service';
import { FileExportService } from './fileexport.service';
import { FileImportService } from './fileimport.service';
import { GuideService } from './guide.service';
import { LayerTimelineService } from './layertimeline.service';
import { PlaybackService } from './playback.service';
import { ShortcutService } from './shortcut.service';
import { SnackBarService } from './snackbar.service';
import { ThemeService } from './theme.service';

/**
 * Creates the services shared across the app. These should only be created once, since some of
 * them subscribe to the store for as long as they are alive. Every feature is off unless the
 * features are passed in, so tests get the app as users see it by default.
 */
export function createEditorServices(
  store: Store<State>,
  { features = NO_FEATURES }: { readonly features?: Features } = {},
) {
  const dialogService = new DialogService();
  const contextMenuService = new ContextMenuService();
  const canvasEditorBridgeService = new CanvasEditorBridgeService();
  const projectService = new ProjectService();
  const snackBarService = new SnackBarService();
  const themeService = new ThemeService(store);
  const layerTimelineService = new LayerTimelineService(store);
  const actionModeService = new ActionModeService(store, layerTimelineService, snackBarService);
  const playbackService = new PlaybackService(store);
  const canvasViewportService = new CanvasViewportService(store);
  const canvasSettingsService = new CanvasSettingsService();
  const guideService = new GuideService(store);
  const fileExportService = new FileExportService(store);
  const fileImportService = new FileImportService(
    store,
    snackBarService,
    layerTimelineService,
    actionModeService,
  );
  const clipboardService = new ClipboardService(
    layerTimelineService,
    playbackService,
    actionModeService,
    snackBarService,
  );
  const shortcutService = new ShortcutService(
    store,
    actionModeService,
    playbackService,
    layerTimelineService,
    canvasViewportService,
    features,
  );
  return {
    features,
    actionModeService,
    canvasEditorBridgeService,
    canvasSettingsService,
    canvasViewportService,
    clipboardService,
    contextMenuService,
    dialogService,
    fileExportService,
    fileImportService,
    guideService,
    layerTimelineService,
    playbackService,
    projectService,
    shortcutService,
    snackBarService,
    themeService,
    dispose() {
      shortcutService.destroy();
      clipboardService.destroy();
      playbackService.dispose();
      canvasViewportService.dispose();
      actionModeService.dispose();
    },
  };
}

export type EditorServices = ReturnType<typeof createEditorServices>;
