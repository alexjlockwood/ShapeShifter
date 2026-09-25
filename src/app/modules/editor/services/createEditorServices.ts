import { DialogService } from 'app/modules/editor/components/dialogs/dialog.service';
import { ProjectService } from 'app/modules/editor/components/project/project.service';
import type { State, Store } from 'app/modules/editor/store';

import { ActionModeService } from './actionmode.service';
import { ClipboardService } from './clipboard.service';
import { FileExportService } from './fileexport.service';
import { FileImportService } from './fileimport.service';
import { LayerTimelineService } from './layertimeline.service';
import { PlaybackService } from './playback.service';
import { ShortcutService } from './shortcut.service';
import { SnackBarService } from './snackbar.service';
import { ThemeService } from './theme.service';

/**
 * Creates the services shared across the app. These should only be created once, since some of
 * them subscribe to the store for as long as they are alive.
 */
export function createEditorServices(store: Store<State>) {
  const dialogService = new DialogService();
  const projectService = new ProjectService();
  const snackBarService = new SnackBarService();
  const themeService = new ThemeService(store);
  const layerTimelineService = new LayerTimelineService(store);
  const actionModeService = new ActionModeService(store, layerTimelineService);
  const playbackService = new PlaybackService(store);
  const fileExportService = new FileExportService(store);
  const fileImportService = new FileImportService(store, snackBarService, layerTimelineService);
  const clipboardService = new ClipboardService(
    layerTimelineService,
    playbackService,
    actionModeService,
  );
  const shortcutService = new ShortcutService(
    store,
    actionModeService,
    playbackService,
    layerTimelineService,
  );
  return {
    actionModeService,
    clipboardService,
    dialogService,
    fileExportService,
    fileImportService,
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
    },
  };
}

export type EditorServices = ReturnType<typeof createEditorServices>;
