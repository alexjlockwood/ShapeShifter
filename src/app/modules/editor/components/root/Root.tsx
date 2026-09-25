import { Canvas } from 'app/modules/editor/components/canvas';
import { DropFilesAction } from 'app/modules/editor/components/dialogs';
import { LayerTimeline } from 'app/modules/editor/components/layertimeline';
import { Playback } from 'app/modules/editor/components/playback';
import { PropertyInput } from 'app/modules/editor/components/propertyinput';
import { SplashScreen } from 'app/modules/editor/components/splashscreen/SplashScreen';
import { Toolbar } from 'app/modules/editor/components/toolbar/Toolbar';
import { useEditorStore, useServices } from 'app/modules/editor/context/EditorContext';
import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { useElementSize } from 'app/modules/editor/hooks/useElementSize';
import { ActionMode, ActionSource } from 'app/modules/editor/model/actionmode';
import { CursorType } from 'app/modules/editor/model/paper';
import { bugsnagClient } from 'app/modules/editor/scripts/bugsnag';
import { on } from 'app/modules/editor/scripts/dom';
import { Duration } from 'app/modules/editor/services/snackbar.service';
import {
  getActionMode,
  getActionModeHover,
  isActionMode as getIsActionMode,
} from 'app/modules/editor/store/actionmode/selectors';
import { isWorkspaceDirty } from 'app/modules/editor/store/common/selectors';
import { getCursorType } from 'app/modules/editor/store/paper/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { createSelector } from 'app/modules/editor/store/selectors';
import { environment } from 'environments/environment';
import { type MouseEvent, useEffect, useMemo, useRef } from 'react';

import { PanelErrorBoundary } from './PanelErrorBoundary';
import './root.scss';
import { useDropTarget } from './useDropTarget';

const IS_DEV_BUILD = !environment.production;
const IS_MOBILE = window.navigator.userAgent.includes('Mobile');

const getCursorClassName = createSelector(
  [getCursorType, getActionMode, getActionModeHover],
  (cursorType, mode, hover) => {
    if (mode === ActionMode.SplitCommands || mode === ActionMode.SplitSubPaths) {
      return `cursor-${CursorType.Pen}`;
    } else if (hover) {
      return `cursor-${CursorType.Pointer}`;
    }
    return `cursor-${cursorType || CursorType.Default}`;
  },
);

export function Root() {
  return <div className="app-root">{IS_MOBILE ? <SplashScreen /> : <Workspace />}</div>;
}

function Workspace() {
  const store = useEditorStore();
  const {
    actionModeService,
    clipboardService,
    dialogService,
    fileImportService,
    layerTimelineService,
    projectService,
    shortcutService,
    snackBarService,
  } = useServices();
  const isActionMode = useAppSelector(getIsActionMode);
  const cursorClassName = useAppSelector(getCursorClassName);

  const displayContainerRef = useRef<HTMLDivElement>(null);
  const displaySize = useElementSize(displayContainerRef);
  const canvasBounds = useMemo(
    () => ({ w: displaySize.w / (isActionMode ? 3 : 1), h: displaySize.h }),
    [displaySize, isActionMode],
  );

  useEffect(() => {
    shortcutService.init();
    clipboardService.init();
    return () => {
      shortcutService.destroy();
      clipboardService.destroy();
    };
  }, [shortcutService, clipboardService]);

  useEffect(() => {
    return on(window, 'beforeunload', event => {
      if (!IS_DEV_BUILD && isWorkspaceDirty(store.getState())) {
        // Asks the user to confirm that they want to leave the page. Older browsers only check
        // returnValue.
        event.preventDefault();
        event.returnValue = true;
      }
    });
  }, [store]);

  useEffect(() => {
    const projectUrl = new URLSearchParams(window.location.search).get('project');
    if (!projectUrl) {
      return undefined;
    }
    const controller = new AbortController();
    projectService
      .getProject(projectUrl, controller.signal)
      .then(({ vectorLayer, animation, hiddenLayerIds }) => {
        store.dispatch(new ResetWorkspace(vectorLayer, animation, hiddenLayerIds));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          snackBarService.show(
            `There was a problem loading the Shape Shifter project`,
            'Dismiss',
            Duration.Long,
          );
        }
      });
    return () => controller.abort();
  }, [store, projectService, snackBarService]);

  const { isDraggingOver, handlers: dropTargetHandlers } = useDropTarget(fileList => {
    if (actionModeService.isActionMode()) {
      // TODO: make action mode automatically exit when layers/blocks are added in other parts of the app
      bugsnagClient.notify('Attempt to import files while in action mode', {
        severity: 'warning',
      });
      return;
    }
    if (!fileList || !fileList.length) {
      return;
    }
    const files = Array.from(fileList);
    const type = files[0].type;
    if (!files.every(file => file.type === type)) {
      // TODO: handle attempts to import different types of files better
      return;
    }
    if (type === 'application/json' || files[0].name.match(/\.shapeshifter$/)) {
      // TODO: Show a dialog here as well?
      fileImportService.import(fileList, true /* resetWorkspace */);
      return;
    }
    void dialogService.dropFiles().then(action => {
      if (action === DropFilesAction.AddToWorkspace) {
        fileImportService.import(fileList);
      } else if (action === DropFilesAction.ResetWorkspace) {
        fileImportService.import(fileList, true /* resetWorkspace */);
      }
    });
  });

  const onClick = (event: MouseEvent<HTMLElement>) => {
    // Clicks inside of menus and dialogs bubble up to here through their React portals.
    if (!event.currentTarget.contains(event.target as Node)) {
      return;
    }
    const actionMode = actionModeService.getActionMode();
    if (actionMode === ActionMode.None) {
      layerTimelineService.clearSelections();
    } else if (actionMode === ActionMode.Selection) {
      actionModeService.setSelections([]);
    } else {
      actionModeService.setActionMode(ActionMode.Selection);
    }
  };

  return (
    // Disable drag start events by default.
    <div
      className={`app-container file-drop-target fx-column fx-flex${
        isDraggingOver ? ' is-dragging-over' : ''
      }`}
      onClick={onClick}
      onDragStart={event => event.preventDefault()}
      {...dropTargetHandlers}
    >
      {/* Toolbar. */}
      <div className="toolbar-container">
        <PanelErrorBoundary panel="toolbar">
          <Toolbar />
        </PanelErrorBoundary>
      </div>
      <div className="fx-row fx-flex">
        <div className="display-container ss-theme-transition fx-column fx-flex">
          {/* Canvas. */}
          <div
            ref={displayContainerRef}
            className={`fx-row fx-align-center fx-flex ${cursorClassName}`}
          >
            {isActionMode && (
              <PanelErrorBoundary panel="start canvas">
                <Canvas
                  className="start"
                  actionSource={ActionSource.From}
                  canvasBounds={canvasBounds}
                />
              </PanelErrorBoundary>
            )}
            <PanelErrorBoundary panel="canvas">
              <Canvas actionSource={ActionSource.Animated} canvasBounds={canvasBounds} />
            </PanelErrorBoundary>
            {isActionMode && (
              <PanelErrorBoundary panel="end canvas">
                <Canvas
                  className="end"
                  actionSource={ActionSource.To}
                  canvasBounds={canvasBounds}
                />
              </PanelErrorBoundary>
            )}
          </div>
          {/* Playback controls. */}
          <PanelErrorBoundary panel="playback">
            <Playback />
          </PanelErrorBoundary>
        </div>
        {/* Property input panel. */}
        {!isActionMode && (
          <PanelErrorBoundary panel="property input">
            <PropertyInput />
          </PanelErrorBoundary>
        )}
      </div>
      {/* Layer list & animation timeline. */}
      <PanelErrorBoundary panel="layer timeline">
        <LayerTimeline />
      </PanelErrorBoundary>
    </div>
  );
}
