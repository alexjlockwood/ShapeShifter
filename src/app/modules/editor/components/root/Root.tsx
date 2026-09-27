import { Canvas } from 'app/modules/editor/components/canvas';
import { DropFilesAction } from 'app/modules/editor/components/dialogs';
import { LayerTimeline } from 'app/modules/editor/components/layertimeline';
import { Playback } from 'app/modules/editor/components/playback';
import { PropertyInput } from 'app/modules/editor/components/propertyinput';
import { SplashScreen } from 'app/modules/editor/components/splashscreen/SplashScreen';
import { ActionBar } from 'app/modules/editor/components/toolbar/ActionBar';
import { ActionModeStatusStrip } from 'app/modules/editor/components/toolbar/ActionModeStatusStrip';
import { Toolbar } from 'app/modules/editor/components/toolbar/Toolbar';
import { useEditorStore, useServices } from 'app/modules/editor/context/EditorContext';
import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { ActionMode, ActionSource } from 'app/modules/editor/model/actionmode';
import { NEWER_VERSION_WARNING, ProjectFormatError } from 'app/modules/editor/model/projectVersion';
import { on } from 'app/modules/editor/scripts/dom';
import { Duration } from 'app/modules/editor/services/snackbar.service';
import {
  getActionMode,
  getActionModeHover,
  isActionMode as getIsActionMode,
} from 'app/modules/editor/store/actionmode/selectors';
import { isWorkspaceDirty } from 'app/modules/editor/store/common/selectors';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { createSelector } from 'app/modules/editor/store/selectors';
import { getSingleSelectedPathBlock } from 'app/modules/editor/store/timeline/selectors';
import { environment } from 'environments/environment';
import { type CSSProperties, type MouseEvent, useEffect, useRef } from 'react';

import { PanelErrorBoundary } from './PanelErrorBoundary';
import './root.scss';
import { useDropTarget } from './useDropTarget';

const IS_DEV_BUILD = !environment.production;
const IS_MOBILE = window.navigator.userAgent.includes('Mobile');

// Action mode's cursors. The canvas editor sets its own (components/canvas/canvas.scss).
const getCursorClassName = createSelector([getActionMode, getActionModeHover], (mode, hover) => {
  if (mode === ActionMode.SplitCommands || mode === ActionMode.SplitSubPaths) {
    return 'cursor-pen';
  }
  return hover ? 'cursor-pointer' : 'cursor-default';
});

// The action mode panels are sized by it (root.scss).
const getViewportAspectRatio = createSelector(getVectorLayer, ({ width, height }) => {
  const aspectRatio = width / height;
  return Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
});

/** Names an action mode panel, with the time it shows. */
function CanvasPanelLabel({ actionSource }: { actionSource: ActionSource }) {
  const block = useAppSelector(getSingleSelectedPathBlock);
  const label =
    actionSource === ActionSource.From
      ? `Start${block ? ` · ${block.startTime} ms` : ''}`
      : actionSource === ActionSource.To
        ? `End${block ? ` · ${block.endTime} ms` : ''}`
        : 'Preview';
  return <div className="canvas-panel-label">{label}</div>;
}

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
  const viewportAspectRatio = useAppSelector(getViewportAspectRatio);

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
      .then(({ vectorLayer, animation, hiddenLayerIds, guides, newerVersion }) => {
        store.dispatch(new ResetWorkspace(vectorLayer, animation, hiddenLayerIds, guides));
        if (newerVersion) {
          snackBarService.show(NEWER_VERSION_WARNING, 'Dismiss', Duration.Long);
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          snackBarService.show(
            error instanceof ProjectFormatError
              ? error.message
              : `There was a problem loading the Shape Shifter project`,
            'Dismiss',
            Duration.Long,
          );
        }
      });
    return () => controller.abort();
  }, [store, projectService, snackBarService]);

  const { isDraggingOver, handlers: dropTargetHandlers } = useDropTarget(fileList => {
    if (!fileList || !fileList.length) {
      return;
    }
    if (actionModeService.isActionMode()) {
      // TODO: make action mode automatically exit when layers/blocks are added in other parts of the app
      snackBarService.show("Can't import while editing a path morph", 'Dismiss', Duration.Short);
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

  // Where the last press started. Pressing a text field and releasing over the workspace (e.g.
  // after selecting some text) clicks the element they have in common, which isn't where either
  // one happened, and past the panels that stop clicks from propagating.
  const pressTargetRef = useRef<EventTarget | null>(null);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    // Clicks inside of menus and dialogs bubble up to here through their React portals.
    if (!event.currentTarget.contains(event.target as Node)) {
      return;
    }
    if (event.target !== pressTargetRef.current) {
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
      onPointerDownCapture={event => {
        pressTargetRef.current = event.target;
      }}
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
          {/* Whether the morph works, in action mode. */}
          {isActionMode && (
            <PanelErrorBoundary panel="action mode status">
              <ActionModeStatusStrip />
            </PanelErrorBoundary>
          )}
          {/* Canvas. */}
          <div
            className={`canvas-row fx-row fx-flex${
              isActionMode ? ' is-action-mode' : ''
            } ${cursorClassName}`}
            style={{ '--viewport-aspect-ratio': viewportAspectRatio } as CSSProperties}
          >
            {isActionMode && (
              <div className="canvas-panel start">
                <CanvasPanelLabel actionSource={ActionSource.From} />
                <PanelErrorBoundary panel="start canvas">
                  <Canvas className="start" actionSource={ActionSource.From} />
                </PanelErrorBoundary>
              </div>
            )}
            {/* The main canvas stays mounted in action mode, so the label goes before it. */}
            <div className="canvas-panel">
              {isActionMode && <CanvasPanelLabel actionSource={ActionSource.Animated} />}
              <PanelErrorBoundary panel="canvas">
                <Canvas actionSource={ActionSource.Animated} />
              </PanelErrorBoundary>
            </div>
            {isActionMode && (
              <div className="canvas-panel end">
                <CanvasPanelLabel actionSource={ActionSource.To} />
                <PanelErrorBoundary panel="end canvas">
                  <Canvas className="end" actionSource={ActionSource.To} />
                </PanelErrorBoundary>
              </div>
            )}
            {isActionMode && (
              <PanelErrorBoundary panel="action bar">
                <ActionBar />
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
