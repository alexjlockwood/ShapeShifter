import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { Tip } from 'app/modules/editor/components/common/Tip';
import { Icon, type IconName } from 'app/modules/editor/components/icons/Icon';
import { Splitter } from 'app/modules/editor/components/splitter';
import { useEditorStore, useServices } from 'app/modules/editor/context/EditorContext';
import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { useMenu } from 'app/modules/editor/hooks/useMenu';
import { ActionMode } from 'app/modules/editor/model/actionmode';
import type { Layer } from 'app/modules/editor/model/layers';
import { EnumProperty, FractionProperty } from 'app/modules/editor/model/properties';
import type { PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { trackEvent } from 'app/modules/editor/scripts/analytics';
import { ColorUtil } from 'app/modules/editor/scripts/common';
import { ShortcutService } from 'app/modules/editor/services';
import { getPropertyInputState } from 'app/modules/editor/store/common/selectors';
import { type KeyboardEvent, type ReactNode, useMemo, useReducer, useState } from 'react';

import {
  buildPropertyInputModel,
  isPathBlockFromValueEmpty,
  isPathBlockToValueEmpty,
  type PropertyInputModel,
  shouldDisableStartActionModeButton,
  shouldShowAnimateLayerButton,
  shouldShowInvalidPathAnimationBlockMsg,
  shouldShowStartActionModeButton,
} from './buildPropertyInputModel';
import type { InspectedProperty } from './InspectedProperty';
import './propertyinput.scss';

const TEXT_INPUT_TYPE_NAMES = new Set([
  'NameProperty',
  'PathProperty',
  'ColorProperty',
  'NumberProperty',
  'FractionProperty',
]);

// TODO: when you enter a 'start time' larger than 'end time', transform 'end time' correctly
export function PropertyInput() {
  const store = useEditorStore();
  const { actionModeService, layerTimelineService, playbackService } = useServices();
  const propertyInputState = useAppSelector(getPropertyInputState);
  // Tracks values that have been entered into text fields but may not have been saved.
  const [enteredValueMap] = useState(() => new Map<string, any>());
  // Entering an invalid value doesn't change the store, so re-render to show it anyway.
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const model = useMemo(
    () =>
      buildPropertyInputModel({ store, layerTimelineService, enteredValueMap }, propertyInputState),
    [store, layerTimelineService, enteredValueMap, propertyInputState],
  );

  const onAnimateLayerClick = (layer: Layer, propertyName: string) => {
    const property = layer.inspectableProperties.get(propertyName);
    if (!property) {
      return;
    }
    const clonedValue = property.cloneValue((layer as any)[propertyName]);
    const currentTime = playbackService.getCurrentTime();
    layerTimelineService.addBlocks([
      {
        layerId: layer.id,
        propertyName,
        fromValue: clonedValue,
        toValue: clonedValue,
        currentTime,
      },
    ]);
  };

  const onValueEditorKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    ip: InspectedProperty<any>,
  ) => {
    // Up/down arrow buttons.
    if (event.keyCode !== 38 && event.keyCode !== 40) {
      return;
    }
    ip.resolveEnteredValue();
    const target = event.currentTarget;
    const numberValue = Number(target.value);
    if (isNaN(numberValue)) {
      forceUpdate();
      return;
    }
    let delta = event.keyCode === 38 ? 1 : -1;
    if (ip.property instanceof FractionProperty) {
      delta *= 0.1;
    }
    if (event.shiftKey) {
      // TODO: make this more obvious somehow
      delta *= 10;
    } else if (ShortcutService.isOsDependentModifierKey(event)) {
      // TODO: make this more obvious somehow
      delta /= 10;
    }
    ip.property.setEditableValue(ip, 'value', Number((numberValue + delta).toFixed(6)));
    forceUpdate();
    setTimeout(() => target.select(), 0);
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    // Clicks shouldn't clear the current selection.
    <div className="app-propertyinput fx-column" onClick={event => event.stopPropagation()}>
      <div className="property-input mat-elevation-z4 ss-theme-transition fx-column fx-flex">
        <Splitter persistId="property-inspector" edge="left" min={200} />
        {model.numSelections === 0 ? (
          <div className="spi-empty fx-flex">Select something to edit its properties</div>
        ) : (
          <div className="fx-column fx-flex">
            <PropertyInputHeader
              model={model}
              onAnimateLayerClick={onAnimateLayerClick}
              onStartActionModeClick={() => {
                trackEvent('action_mode_start');
                actionModeService.setActionMode(ActionMode.Selection);
              }}
            />
            <div className="spi-body fx-column fx-flex">
              {!model.inspectedProperties.length && (
                <div className="spi-empty fx-flex">No shared properties to view or edit</div>
              )}
              {model.inspectedProperties.map(ip => (
                <div className="spi-property" key={ip.propertyName}>
                  <div className="spi-property-name">{ip.propertyName}</div>
                  <div className="spi-property-value fx-row">
                    {ip.typeName === 'ColorProperty' && (
                      <div
                        className="spi-property-color-preview"
                        style={{ backgroundColor: ColorUtil.androidToCssHexColor(ip.value) }}
                      />
                    )}
                    {!ip.isEditable() && (
                      // Only show text if the property isn't inspectable.
                      <span className="spi-property-value-static fx-flex">
                        {ip.getDisplayValue()}
                      </span>
                    )}
                    {ip.isEditable() && (
                      <div className="spi-property-value-editor fx-column fx-flex">
                        {TEXT_INPUT_TYPE_NAMES.has(ip.typeName) && (
                          <input
                            className={
                              ip.typeName === 'PathProperty' &&
                              shouldShowInvalidPathAnimationBlockMsg(model)
                                ? 'has-input-error'
                                : undefined
                            }
                            name={ip.propertyName}
                            value={ip.editableValue ?? ''}
                            onChange={event => {
                              ip.editableValue = event.target.value;
                              forceUpdate();
                            }}
                            onKeyDown={event => onValueEditorKeyDown(event, ip)}
                            onBlur={() => {
                              ip.resolveEnteredValue();
                              forceUpdate();
                            }}
                          />
                        )}
                        {ip.typeName === 'EnumProperty' && <EnumPropertyEditor ip={ip} />}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {shouldShowInvalidPathAnimationBlockMsg(model) && (
                <InvalidPathAnimationBlockMessage
                  block={model.model}
                  onAutoFixClick={() => actionModeService.autoFix()}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyInputHeader({
  model,
  onAnimateLayerClick,
  onStartActionModeClick,
}: {
  model: PropertyInputModel;
  onAnimateLayerClick: (layer: Layer, propertyName: string) => void;
  onStartActionModeClick: () => void;
}) {
  const addTimelineBlockMenu = useMenu();
  const isStartActionModeDisabled = shouldDisableStartActionModeButton(model);
  return (
    <div className="spi-header mat-elevation-z2 ss-theme-transition fx-align-center fx-flex-none">
      <Icon className="spi-selection-icon" name={model.icon as IconName} />
      <div className="spi-selection-description-container fx-column fx-flex">
        <span className="spi-selection-description">{model.description}</span>
        <span className="spi-selection-sub-description">{model.subDescription}</span>
      </div>
      {shouldShowAnimateLayerButton(model) && (
        <>
          <Tooltip title="Animate this layer" placement="left">
            <IconButton
              className="spi-secondary-icon"
              aria-label="Animate this layer"
              onClick={addTimelineBlockMenu.openMenu}
            >
              <Icon name="animationblock" />
            </IconButton>
          </Tooltip>
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
                  onAnimateLayerClick(model.model, propertyName);
                }}
              >
                {propertyName}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {shouldShowStartActionModeButton(model) && (
        <Tip
          title="Edit path morphing animation"
          placement="left"
          disabled={isStartActionModeDisabled}
        >
          <IconButton
            className="spi-secondary-icon"
            aria-label="Edit path morphing animation"
            disabled={isStartActionModeDisabled}
            onClick={onStartActionModeClick}
          >
            <Icon name="edit" />
          </IconButton>
        </Tip>
      )}
    </div>
  );
}

function EnumPropertyEditor({ ip }: { ip: InspectedProperty<any> }) {
  const enumMenu = useMenu();
  const { options } = ip.property as EnumProperty;
  return (
    <>
      <button className="spi-property-value-menu-target" onClick={enumMenu.openMenu}>
        <span className="spi-property-value-menu-current-value">{ip.getDisplayValue()}</span>
        <Icon className="spi-property-value-menu-arrow" name="arrow_drop_down" />
      </button>
      <Menu anchorEl={enumMenu.anchorEl} open={enumMenu.open} onClose={enumMenu.closeMenu}>
        {options.map(option => (
          <MenuItem
            key={option.value}
            onClick={() => {
              enumMenu.closeMenu();
              ip.value = option.value;
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function InvalidPathAnimationBlockMessage({
  block,
  onAutoFixClick,
}: {
  block: PathAnimationBlock;
  onAutoFixClick: () => void;
}) {
  const isFromValueEmpty = isPathBlockFromValueEmpty(block);
  const isToValueEmpty = isPathBlockToValueEmpty(block);
  let message: ReactNode;
  if (isFromValueEmpty && !isToValueEmpty) {
    message = (
      <>
        <i>fromValue</i> must not be empty
      </>
    );
  } else if (!isFromValueEmpty && isToValueEmpty) {
    message = (
      <>
        <i>toValue</i> must not be empty
      </>
    );
  } else if (isFromValueEmpty && isToValueEmpty) {
    message = (
      <>
        <i>fromValue</i> and <i>toValue</i> must not be empty
      </>
    );
  } else {
    message = (
      <>
        Paths are incompatible. <i>Auto fix</i> or click the <i>edit path morphing animation</i>{' '}
        button above.
      </>
    );
  }
  return (
    <div className="alert alert-danger fx-row">
      <span className="paths-incompatible-text">{message}</span>
      {!isFromValueEmpty && !isToValueEmpty && (
        <Tooltip title="Auto fix">
          <IconButton className="auto-fix-button" aria-label="Auto fix" onClick={onAutoFixClick}>
            <Icon name="autofix" />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}
