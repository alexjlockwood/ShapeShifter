import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Tip } from 'app/modules/editor/components/common/Tip';
import { Icon, type IconName } from 'app/modules/editor/components/icons/Icon';
import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { useMenu } from 'app/modules/editor/hooks/useMenu';
import {
  ClipPathLayer,
  GroupLayer,
  type Layer,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { PathAnimationBlock } from 'app/modules/editor/model/timeline';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import { getLayerListTreeState } from 'app/modules/editor/store/common/selectors';
import _ from 'lodash';
import { memo, type MouseEvent, useMemo } from 'react';

import './layerlisttree.scss';
import { useLayerTimelineController } from './LayerTimelineContext';

function buildLayerModel(
  layer: Layer,
  {
    animation,
    selectedLayerIds,
    collapsedLayerIds,
    hiddenLayerIds,
    hoveredLayerId,
    isActionMode,
  }: ReturnType<typeof getLayerListTreeState>,
) {
  const isExpandable = layer instanceof VectorLayer || layer instanceof GroupLayer;
  const availablePropertyNames = Array.from(
    ModelUtil.getAvailablePropertyNamesForLayer(layer, animation),
  );
  const getExistingPropertyNamesFn = (layerId: string) => {
    return _.keys(ModelUtil.getOrderedBlocksByPropertyByLayer(animation)[layerId]);
  };
  const existingPropertyNames = getExistingPropertyNamesFn(layer.id);
  const canBeConvertedToPath = layer instanceof ClipPathLayer;
  // We can't convert a path into a clip path if it has incompatible animation blocks.
  const canBeConvertedToClipPath =
    layer instanceof PathLayer &&
    // TODO: comparing the sets of all animatable properties for each layer type would be more robust
    !animation.blocks.some(b => b.layerId === layer.id && !(b instanceof PathAnimationBlock));
  const canBeFlattened =
    layer instanceof GroupLayer &&
    layer.children.length > 0 &&
    // TODO: allow merging groups w/ existing blocks in some cases?
    existingPropertyNames.length === 0 &&
    layer.children.every(l => {
      return (
        l instanceof PathLayer ||
        l instanceof ClipPathLayer ||
        // TODO: allow merging groups into groups w/ existing blocks in some cases?
        getExistingPropertyNamesFn(l.id).length === 0
      );
    });
  return {
    isSelected: selectedLayerIds.has(layer.id),
    isHovered: hoveredLayerId === layer.id,
    isExpandable,
    isExpanded: !collapsedLayerIds.has(layer.id),
    isVisible: !hiddenLayerIds.has(layer.id),
    availablePropertyNames,
    existingPropertyNames,
    isActionMode,
    canBeConvertedToClipPath,
    canBeConvertedToPath,
    canBeFlattened,
  };
}

/**
 * Lists the layer, its animated properties, and (recursively) its children.
 */
export const LayerListTree = memo(function LayerListTree({ layer }: { layer: Layer }) {
  const controller = useLayerTimelineController();
  const layerListTreeState = useAppSelector(getLayerListTreeState);
  const model = useMemo(
    () => buildLayerModel(layer, layerListTreeState),
    [layer, layerListTreeState],
  );
  const overflowMenu = useMenu();
  const addTimelineBlockMenu = useMenu();
  const { isActionMode } = model;

  const onToggleExpanded = (event: MouseEvent) => {
    event.stopPropagation();
    if (model.isExpandable) {
      controller.onLayerToggleExpanded(event.nativeEvent, layer);
    }
  };

  // Stops the click from also selecting the layer.
  const onMenuButtonClick = (openMenu: (event: MouseEvent<HTMLElement>) => void) => {
    return (event: MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      openMenu(event);
    };
  };

  const layerClassNames = [
    'slt-layer',
    `slt-layer-type-${layer.type}`,
    'fx-row',
    'fx-align-start-center',
    model.isSelected && 'is-selected',
    model.isHovered && 'is-hovered',
    isActionMode && 'is-disabled',
  ];

  return (
    <div className="app-layerlisttree">
      <div
        className={layerClassNames.filter(Boolean).join(' ')}
        onClick={event => {
          event.stopPropagation();
          if (!isActionMode) {
            controller.onLayerClick(event.nativeEvent, layer);
          }
        }}
        onDoubleClick={onToggleExpanded}
        onMouseDown={event => {
          if (!isActionMode) {
            controller.onLayerMouseDown(event.nativeEvent, layer);
          }
        }}
      >
        {model.isExpandable && (
          <Tip
            title={model.isExpanded ? 'Collapse layer' : 'Expand layer'}
            placement="right"
            enterDelay={1000}
            disabled={isActionMode}
          >
            <IconButton disabled={isActionMode} onClick={onToggleExpanded}>
              <Icon name={model.isExpanded ? 'expand_more' : 'chevron_right'} />
            </IconButton>
          </Tip>
        )}
        {/* Add an extra 20px margin if the expand/collapse icon isn't being displayed. */}
        <Icon
          className={model.isExpandable ? 'slt-layer-type-icon' : 'slt-layer-type-icon is-indented'}
          name={layer.type as IconName}
        />
        <span className="slt-layer-id-text fx-flex">{layer.name}</span>
        {/* Show overflow options. */}
        {(model.canBeConvertedToClipPath || model.canBeConvertedToPath || model.canBeFlattened) && (
          <IconButton
            className="slt-layer-action-button slt-layer-more-actions"
            disabled={isActionMode}
            onClick={onMenuButtonClick(overflowMenu.openMenu)}
          >
            <Icon name="more_vert" />
          </IconButton>
        )}
        {/* Visibility toggle. */}
        <Tip
          title={model.isVisible ? 'Hide layer' : 'Show layer'}
          enterDelay={1000}
          disabled={isActionMode}
        >
          <IconButton
            className={`slt-layer-action-button slt-layer-visibility-toggle${
              model.isVisible ? ' is-checked' : ''
            }`}
            disabled={isActionMode}
            onClick={event => {
              event.stopPropagation();
              if (!isActionMode) {
                controller.onLayerToggleVisibility(layer);
              }
            }}
          >
            <Icon name={model.isVisible ? 'visibility' : 'visibility_off'} />
          </IconButton>
        </Tip>
        {/* Animate layer. */}
        {model.availablePropertyNames.length > 0 && (
          <Tip title="Animate this layer" enterDelay={1000} disabled={isActionMode}>
            <IconButton
              className="slt-layer-action-button"
              disabled={isActionMode}
              onClick={onMenuButtonClick(addTimelineBlockMenu.openMenu)}
            >
              <Icon name="animationblock" />
            </IconButton>
          </Tip>
        )}
      </div>

      {/* The menus are rendered outside of the layer so that their clicks don't select it. */}
      <Menu
        anchorEl={overflowMenu.anchorEl}
        open={overflowMenu.open}
        onClose={overflowMenu.closeMenu}
      >
        {model.canBeConvertedToClipPath && (
          <MenuItem
            onClick={() => {
              overflowMenu.closeMenu();
              controller.onConvertToClipPathClick(layer);
            }}
          >
            Convert to clip path
          </MenuItem>
        )}
        {model.canBeConvertedToPath && (
          <MenuItem
            onClick={() => {
              overflowMenu.closeMenu();
              controller.onConvertToPathClick(layer);
            }}
          >
            Convert to path
          </MenuItem>
        )}
        {model.canBeFlattened && (
          <MenuItem
            onClick={() => {
              overflowMenu.closeMenu();
              controller.onFlattenGroupClick(layer);
            }}
          >
            Flatten group
          </MenuItem>
        )}
      </Menu>
      <Menu
        anchorEl={addTimelineBlockMenu.anchorEl}
        open={addTimelineBlockMenu.open}
        onClose={addTimelineBlockMenu.closeMenu}
      >
        {model.availablePropertyNames.map(propertyName => (
          <MenuItem
            key={propertyName}
            onClick={() => {
              addTimelineBlockMenu.closeMenu();
              if (!isActionMode) {
                controller.onAddTimelineBlockClick(layer, propertyName);
              }
            }}
          >
            {propertyName}
          </MenuItem>
        ))}
      </Menu>

      {/* List the property names that have been animated. */}
      {model.isExpanded && model.existingPropertyNames.length > 0 && (
        <div className="slt-properties">
          {model.existingPropertyNames.map(propertyName => (
            <div className="slt-property fx-row fx-align-start-center" key={propertyName}>
              <span className="slt-property-name">{propertyName}</span>
              <Tip title="Add another animation" enterDelay={1000} disabled={isActionMode}>
                <IconButton
                  className="slt-property-add-timeline-block-button"
                  disabled={isActionMode}
                  onClick={event => {
                    // Otherwise the workspace would deselect the new block.
                    event.stopPropagation();
                    if (!isActionMode) {
                      controller.onAddTimelineBlockClick(layer, propertyName);
                    }
                  }}
                >
                  <Icon name="add" />
                </IconButton>
              </Tip>
            </div>
          ))}
        </div>
      )}

      {/* List the layer's children if it is expanded. */}
      {model.isExpanded && layer.children.length > 0 && (
        <ul className="slt-children">
          {layer.children.map(child => (
            <li key={child.id} className="slt-layer-container" data-layer-id={child.id}>
              <LayerListTree layer={child} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
