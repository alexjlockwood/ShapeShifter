import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Tip } from 'app/modules/editor/components/common/Tip';
import { Icon } from 'app/modules/editor/components/icons/Icon';
import { Splitter } from 'app/modules/editor/components/splitter';
import { useEditorStore, useServices } from 'app/modules/editor/context/EditorContext';
import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { useMenu } from 'app/modules/editor/hooks/useMenu';
import { useScrollGroup } from 'app/modules/editor/hooks/useScrollGroup';
import { on } from 'app/modules/editor/scripts/dom';
import { getLayerTimelineState } from 'app/modules/editor/store/common/selectors';
import { type MouseEvent, type RefObject, useLayoutEffect, useRef, useState } from 'react';

import { LayerListTree } from './LayerListTree';
import { LayerTimelineContext } from './LayerTimelineContext';
import {
  DEFAULT_HORIZ_ZOOM,
  type DragIndicatorInfo,
  LayerTimelineController,
} from './LayerTimelineController';
import './layertimeline.scss';
import { TimelineAnimationRow } from './TimelineAnimationRow';
import { TimelineGrid } from './TimelineGrid';

export function LayerTimeline() {
  const store = useEditorStore();
  const services = useServices();
  const { animation, vectorLayer, isAnimationSelected, isActionMode } =
    useAppSelector(getLayerTimelineState);
  const [horizZoom, setHorizZoom] = useState(DEFAULT_HORIZ_ZOOM);
  const [dragIndicator, setDragIndicator] = useState<DragIndicatorInfo>({
    isVisible: false,
    left: 0,
    top: 0,
  });

  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineAnimationRef = useRef<HTMLDivElement>(null);
  const layersScrollerRef = useRef<HTMLDivElement>(null);
  const timelineScrollerRef = useRef<HTMLDivElement>(null);
  const openFileInputRef = useRef<HTMLInputElement>(null);
  const svgFileInputRef = useRef<HTMLInputElement>(null);
  const vectorDrawableFileInputRef = useRef<HTMLInputElement>(null);

  // The controller is created during the first render (without side effects) so that the
  // layer list and timeline rows can use it right away.
  const [controller] = useState(
    () =>
      new LayerTimelineController(
        { timeline: timelineRef, timelineAnimation: timelineAnimationRef },
        { setHorizZoom, setDragIndicator },
        store,
        services,
      ),
  );
  useLayoutEffect(() => {
    controller.init();
    return () => controller.dispose();
  }, [controller]);

  // React's wheel listeners are passive, so they can't prevent the page from scrolling.
  useLayoutEffect(() => {
    return on(timelineRef.current, 'wheel', event => controller.onWheelEvent(event), {
      passive: false,
    });
  }, [controller]);

  useScrollGroup(layersScrollerRef, 'timeline');
  useScrollGroup(timelineScrollerRef, 'timeline');

  const fileMenu = useMenu();
  const importMenu = useMenu();
  const exportMenu = useMenu();
  const addLayerMenu = useMenu();

  // Opens the menu without also clearing the current selection.
  const onMenuButtonClick = (openMenu: (event: MouseEvent<HTMLElement>) => void) => {
    return (event: MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      openMenu(event);
    };
  };

  // Closes the menu before performing the menu item's action.
  const menuItemClick = (menu: ReturnType<typeof useMenu>, fn: () => void) => () => {
    menu.closeMenu();
    fn();
  };

  const launchFilePicker = (menu: ReturnType<typeof useMenu>, ref: RefObject<HTMLInputElement>) => {
    menu.closeMenu();
    controller.onLaunchFilePickerClick(ref.current);
  };

  return (
    <LayerTimelineContext value={controller}>
      <div className="studio-layer-timeline mat-elevation-z8 ss-theme-transition">
        <Splitter edge="top" min={200} persistId="layer-timeline" />

        <div className="slt-layers mat-elevation-z2 ss-theme-transition fx-column">
          <Splitter edge="right" min={200} persistId="layer-list" />

          <div className="slt-header mat-elevation-z2 fx-row fx-align-start-center">
            <button
              className="slt-layers-menu-group-button"
              onClick={onMenuButtonClick(fileMenu.openMenu)}
            >
              File
            </button>
            <Menu anchorEl={fileMenu.anchorEl} open={fileMenu.open} onClose={fileMenu.closeMenu}>
              <MenuItem onClick={menuItemClick(fileMenu, () => controller.onNewWorkspaceClick())}>
                New
              </MenuItem>
              <MenuItem onClick={() => launchFilePicker(fileMenu, openFileInputRef)}>Open</MenuItem>
              <MenuItem onClick={menuItemClick(fileMenu, () => controller.onSaveToFileClick())}>
                Save
              </MenuItem>
              <MenuItem onClick={menuItemClick(fileMenu, () => controller.onLoadDemoClick())}>
                Demo
              </MenuItem>
            </Menu>

            <button
              className={`slt-layers-menu-group-button${isActionMode ? ' is-disabled' : ''}`}
              disabled={isActionMode}
              onClick={onMenuButtonClick(importMenu.openMenu)}
            >
              Import
            </button>
            <Menu
              anchorEl={importMenu.anchorEl}
              open={importMenu.open}
              onClose={importMenu.closeMenu}
            >
              <MenuItem onClick={() => launchFilePicker(importMenu, svgFileInputRef)}>SVG</MenuItem>
              <MenuItem onClick={() => launchFilePicker(importMenu, vectorDrawableFileInputRef)}>
                Vector Drawable
              </MenuItem>
            </Menu>

            <button
              className={`slt-layers-menu-group-button${isActionMode ? ' is-disabled' : ''}`}
              disabled={isActionMode}
              onClick={onMenuButtonClick(exportMenu.openMenu)}
            >
              Export
            </button>
            <Menu
              anchorEl={exportMenu.anchorEl}
              open={exportMenu.open}
              onClose={exportMenu.closeMenu}
            >
              <MenuItem onClick={menuItemClick(exportMenu, () => controller.onExportSvgClick())}>
                SVG
              </MenuItem>
              <MenuItem
                onClick={menuItemClick(exportMenu, () => controller.onExportVectorDrawableClick())}
              >
                Vector Drawable
              </MenuItem>
              <MenuItem
                onClick={menuItemClick(exportMenu, () =>
                  controller.onExportAnimatedVectorDrawableClick(),
                )}
              >
                Animated Vector Drawable
              </MenuItem>
              <MenuItem
                onClick={menuItemClick(exportMenu, () => controller.onExportSvgSpritesheetClick())}
              >
                SVG spritesheet
              </MenuItem>
            </Menu>

            <div className="fx-flex" />

            <Tip title="Add layer" disabled={isActionMode}>
              <IconButton
                aria-label="Add layer"
                disabled={isActionMode}
                onClick={onMenuButtonClick(addLayerMenu.openMenu)}
              >
                <Icon name="addlayer" />
              </IconButton>
            </Tip>
            <Menu
              anchorEl={addLayerMenu.anchorEl}
              open={addLayerMenu.open}
              onClose={addLayerMenu.closeMenu}
            >
              <MenuItem
                onClick={menuItemClick(addLayerMenu, () => controller.onAddPathLayerClick())}
              >
                New path
              </MenuItem>
              <MenuItem
                onClick={menuItemClick(addLayerMenu, () => controller.onAddClipPathLayerClick())}
              >
                New clip path
              </MenuItem>
              <MenuItem
                onClick={menuItemClick(addLayerMenu, () => controller.onAddGroupLayerClick())}
              >
                New group layer
              </MenuItem>
            </Menu>
          </div>

          <div ref={layersScrollerRef} className="slt-layers-list-scroller fx-flex">
            {/* Layer list. */}
            <div className="slt-layers-list">
              {/* Keyed by the layer's id so that the tree is recreated when the workspace is
                  reset. The root layer doesn't set a data-layer-id. */}
              <div className="slt-layer-container fx-column" key={vectorLayer.id}>
                <LayerListTree layer={vectorLayer} />
              </div>
            </div>
            <div
              className="slt-layers-list-drag-indicator"
              style={{
                display: dragIndicator.isVisible ? 'block' : 'none',
                left: dragIndicator.left,
                top: dragIndicator.top,
              }}
            />
            {vectorLayer.children.length === 0 && animation.blocks.length === 0 && (
              <div className="slt-layers-empty">To get started, drag + drop an SVG file here</div>
            )}
          </div>
        </div>

        {/* Animation timeline. */}
        <div ref={timelineRef} className="slt-timeline">
          <div
            ref={timelineAnimationRef}
            className="slt-timeline-animation is-active fx-column"
            style={{ width: animation.duration * horizZoom + 40 }}
          >
            <div className="slt-header mat-elevation-z2">
              <div className="fx-row fx-align-start-center">
                <div
                  className={[
                    'slt-timeline-animation-meta',
                    isActionMode && 'is-disabled',
                    isAnimationSelected && 'is-selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={event => {
                    event.stopPropagation();
                    controller.onAnimationHeaderTextClick(event.nativeEvent);
                  }}
                >
                  <span
                    className={`slt-timeline-animation-name${isActionMode ? ' is-disabled' : ''}`}
                  >
                    {animation.name}
                  </span>
                  <span
                    className={`slt-timeline-animation-duration${
                      isActionMode ? ' is-disabled' : ''
                    }`}
                  >
                    {animation.duration}ms
                  </span>
                </div>
                <Tip title={`Zoom to fit (${services.shortcutService.getZoomToFitText()})`}>
                  <IconButton
                    aria-label="Zoom to fit"
                    onClick={event => {
                      event.stopPropagation();
                      controller.autoZoomToAnimation();
                    }}
                  >
                    <Icon name="zoom_out_map" />
                  </IconButton>
                </Tip>
              </div>
              <TimelineGrid
                className="slt-timeline-header-grid ss-theme-transition"
                isHeader
                animation={animation}
                horizZoom={horizZoom}
                onScrub={event => controller.onTimelineHeaderScrub(event)}
              />
            </div>
            <TimelineGrid
              className="slt-timeline-grid"
              isHeader={false}
              animation={animation}
              horizZoom={horizZoom}
            />

            <div ref={timelineScrollerRef} className="slt-timeline-animation-scroller">
              <div className="slt-timeline-animation-rows">
                {/* Keyed by the layer's id so that the rows are recreated when the workspace is
                    reset. */}
                <TimelineAnimationRow key={vectorLayer.id} layer={vectorLayer} />
              </div>
            </div>
          </div>
        </div>

        {/* The file pickers opened by the File and Import menus. Clicks are stopped so that
            opening them doesn't clear the current selection. */}
        <input
          ref={openFileInputRef}
          className="slt-file-input"
          type="file"
          accept=".shapeshifter"
          onClick={event => event.stopPropagation()}
          onChange={event => controller.onImportedFilesPicked(event.target.files)}
        />
        <input
          ref={svgFileInputRef}
          className="slt-file-input"
          type="file"
          accept=".svg"
          multiple
          onClick={event => event.stopPropagation()}
          onChange={event => controller.onImportedFilesPicked(event.target.files)}
        />
        <input
          ref={vectorDrawableFileInputRef}
          className="slt-file-input"
          type="file"
          accept=".xml"
          multiple
          onClick={event => event.stopPropagation()}
          onChange={event => controller.onImportedFilesPicked(event.target.files)}
        />
      </div>
    </LayerTimelineContext>
  );
}
