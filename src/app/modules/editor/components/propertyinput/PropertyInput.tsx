import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import type { PointEditState } from 'app/modules/editor/components/canvas/CanvasEditorApi';
import { useCanvasEditorModule } from 'app/modules/editor/components/canvas/useCanvasEditorModule';
import { ColorPropertyEditor } from 'app/modules/editor/components/colorpicker/ColorPropertyEditor';
import { collectDocumentColors } from 'app/modules/editor/components/colorpicker/documentColors';
import { Tip } from 'app/modules/editor/components/common/Tip';
import { Icon, type IconName } from 'app/modules/editor/components/icons/Icon';
import { Splitter } from 'app/modules/editor/components/splitter';
import { useEditorStore, useServices } from 'app/modules/editor/context/EditorContext';
import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { useMenu } from 'app/modules/editor/hooks/useMenu';
import { ClipPathLayer, Layer, PathLayer } from 'app/modules/editor/model/layers';
import type { Path } from 'app/modules/editor/model/paths';
import { EnumProperty } from 'app/modules/editor/model/properties';
import { Animation, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { trackEvent } from 'app/modules/editor/scripts/analytics';
import { ShortcutService } from 'app/modules/editor/services';
import { Duration } from 'app/modules/editor/services/snackbar.service';
import { getPropertyInputState } from 'app/modules/editor/store/common/selectors';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getAnimatedVectorLayer } from 'app/modules/editor/store/playback/selectors';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import {
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  buildPropertyInputModel,
  getColorAlphaMultiplier,
  isPathBlockFromValueEmpty,
  isPathBlockToValueEmpty,
  type PropertyInputModel,
  shouldDisableStartActionModeButton,
  shouldShowAnimateLayerButton,
  shouldShowInvalidPathAnimationBlockMsg,
  shouldShowStartActionModeButton,
} from './buildPropertyInputModel';
import type { InspectedProperty } from './InspectedProperty';
import {
  buildInspectorSections,
  type InspectorField,
  type InspectorRow,
  type InspectorSection,
  type SectionId,
} from './inspectorSections';
import { InterpolatorEditor } from './InterpolatorEditor';
import { areLayoutsEqual, getLayoutValues, type LayoutKey, setLayoutValue } from './layoutValues';
import { MenuSelect } from './MenuSelect';
import { NumberField } from './NumberField';
import { getSteppedValue } from './steppedValue';
import './propertyinput.scss';

const TEXT_INPUT_TYPE_NAMES = new Set([
  'NameProperty',
  'PathProperty',
  'ColorProperty',
  'NumberProperty',
  'FractionProperty',
]);

// Only these sections can be collapsed, since the others are short and always useful.
const COLLAPSIBLE_SECTIONS: ReadonlySet<SectionId> = new Set(['trimPath']);

// While a path's points are edited, the point-edit view takes the place of these.
const POINT_EDIT_EXCLUDED: ReadonlySet<string> = new Set(['pathData']);

/**
 * The property inspector: the selected layer's, block's, or animation's properties in sections of
 * compact rows (inspectorSections.ts), a Layout section with a layer's bounds, and the points of a
 * path while they're edited on the canvas (the canvas editor's PathInspector).
 */
// TODO: when you enter a 'start time' larger than 'end time', transform 'end time' correctly
export function PropertyInput() {
  const store = useEditorStore();
  const {
    actionModeService,
    layerTimelineService,
    canvasEditorBridgeService: bridge,
    snackBarService,
    features,
  } = useServices();
  // With the canvas editor on, the points of a path being edited are shown by its PathInspector.
  const editorModule = useCanvasEditorModule(features.canvasEditor);
  const bridgeState = useSyncExternalStore(bridge.subscribe, bridge.getState);
  const propertyInputState = useAppSelector(getPropertyInputState);
  // Tracks values that have been entered into text fields but may not have been saved.
  const [enteredValueMap] = useState(() => new Map<string, any>());
  // Entering an invalid value doesn't change the store, so re-render to show it anyway.
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  // The sections that were opened or closed, which stay that way for other selections.
  const [openSections, setOpenSections] = useState<Partial<Record<SectionId, boolean>>>({});
  const [isAdvancedOpen, setAdvancedOpen] = useState(false);

  const model = useMemo(
    () =>
      buildPropertyInputModel({ store, layerTimelineService, enteredValueMap }, propertyInputState),
    [store, layerTimelineService, enteredValueMap, propertyInputState],
  );
  // The color picker's "In this document" swatches, shared by every color property shown below.
  const documentColors = useMemo(
    () => collectDocumentColors(propertyInputState.vectorLayer, propertyInputState.animation),
    [propertyInputState.vectorLayer, propertyInputState.animation],
  );
  const layer = model.numSelections === 1 && model.model instanceof Layer ? model.model : undefined;
  const pointEdit =
    editorModule && layer && bridgeState.pointEdit?.layerId === layer.id
      ? bridgeState.pointEdit
      : undefined;
  const sections = useMemo(
    () =>
      buildInspectorSections(model.inspectedProperties, {
        animatablePropertyNames: model.animatablePropertyNames ?? new Set(),
        animatedPropertyNames: model.animatedPropertyNames ?? new Set(),
        isAnimation: model.model instanceof Animation,
        excludedPropertyNames: pointEdit ? POINT_EDIT_EXCLUDED : undefined,
      }),
    [model, pointEdit],
  );
  const canEditPoints =
    !!editorModule &&
    bridgeState.isAvailable &&
    (layer instanceof PathLayer || layer instanceof ClipPathLayer);

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
    const value = getSteppedValue(ip.property, target.value, {
      up: event.keyCode === 38,
      shiftKey: event.shiftKey,
      modifierKey: ShortcutService.isOsDependentModifierKey(event),
    });
    if (value === undefined) {
      forceUpdate();
      return;
    }
    ip.property.setEditableValue(ip, 'value', value);
    forceUpdate();
    setTimeout(() => target.select(), 0);
    event.preventDefault();
    event.stopPropagation();
  };

  const renderField = (row: InspectorRow, field: InspectorField) => (
    <PropertyField
      key={field.ip.propertyName}
      field={field}
      ariaLabel={field.label ? `${row.label} ${field.label}` : row.label}
      modelId={model.model?.id}
      hasError={
        field.ip.typeName === 'PathProperty' && shouldShowInvalidPathAnimationBlockMsg(model)
      }
      colorProps={{
        documentColors,
        alphaMultiplier: getColorAlphaMultiplier(model.model, field.ip.propertyName),
      }}
      onTextChange={(ip, value) => {
        ip.editableValue = value;
        forceUpdate();
      }}
      onKeyDown={onValueEditorKeyDown}
      onBlur={ip => {
        ip.resolveEnteredValue();
        forceUpdate();
      }}
    />
  );

  const renderRow = (row: InspectorRow) => {
    const animateButton = layer && row.animation && (
      <RowAnimateButton
        row={row}
        onAnimate={propertyName => layerTimelineService.addBlockForProperty(layer.id, propertyName)}
      />
    );
    if (layer && row.id === 'pathData' && row.fields[0].ip.typeName === 'PathProperty') {
      return (
        <PathRows
          key={row.id}
          path={row.fields[0].ip.value}
          textField={renderField(row, row.fields[0])}
          canEditPoints={canEditPoints}
          onEditPoints={() => {
            if (!bridge.startPointEdit(layer.id)) {
              snackBarService.show(
                "The path's points can't be edited right now, e.g. while it's hidden or morphing",
                'Dismiss',
                Duration.Long,
              );
            }
          }}
          isAdvancedOpen={isAdvancedOpen}
          onAdvancedToggle={setAdvancedOpen}
          animateButton={animateButton}
        />
      );
    }
    return (
      <div
        key={row.id}
        className={row.isWide ? 'spi-property spi-row spi-row-wide' : 'spi-property spi-row'}
      >
        <span className="spi-row-label">{row.label}</span>
        <div className="spi-row-fields">{row.fields.map(field => renderField(row, field))}</div>
        {animateButton}
      </div>
    );
  };

  const renderSection = (section: InspectorSection) => {
    const isCollapsible = COLLAPSIBLE_SECTIONS.has(section.id);
    const isOpen = !isCollapsible || (openSections[section.id] ?? !section.isCollapsedByDefault);
    return (
      <section
        key={section.id}
        className={`spi-section spi-section-${section.id}`}
        aria-label={section.title}
      >
        {section.title &&
          (isCollapsible ? (
            <button
              type="button"
              className="spi-section-title spi-section-toggle"
              aria-expanded={isOpen}
              onClick={() => setOpenSections({ ...openSections, [section.id]: !isOpen })}
            >
              <Icon
                name="chevron_right"
                className={isOpen ? 'spi-chevron is-expanded' : 'spi-chevron'}
              />
              {section.title}
            </button>
          ) : (
            <div className="spi-section-title">{section.title}</div>
          ))}
        {isOpen && section.rows.map(renderRow)}
      </section>
    );
  };

  const PathInspector = editorModule?.PathInspector;
  const sectionElements: ReactNode[] = [];
  for (const section of sections) {
    sectionElements.push(renderSection(section));
    // Layout, or the points while they're edited, go right after the name.
    if (section.id === 'name' && layer && !pointEdit) {
      // Keyed by the layer, so that text typed for one layer isn't saved to the next.
      sectionElements.push(<LayoutSection key={`layout-${layer.id}`} layerId={layer.id} />);
    }
    if (section.id === 'name' && pointEdit && PathInspector && layer) {
      sectionElements.push(
        <PathInspector
          key={`points-${layer.id}`}
          layerId={layer.id}
          state={pointEdit}
          onEdit={(layerId, edit) => bridge.editPoints(layerId, edit)}
          onSelect={anchorIds => bridge.setSelectedAnchorIds(layer.id, anchorIds)}
          onCommand={command => bridge.runPointCommand(command)}
        />,
      );
    }
  }

  return (
    // Clicks shouldn't clear the current selection.
    <div className="app-propertyinput fx-column" onClick={event => event.stopPropagation()}>
      <div className="property-input mat-elevation-z4 ss-theme-transition fx-column fx-flex">
        <Splitter persistId="property-inspector" edge="left" min={200} />
        {model.numSelections === 0 ? (
          <div className="spi-empty fx-flex">Select something to edit its properties</div>
        ) : (
          <div className="spi-content fx-column fx-flex">
            <PropertyInputHeader
              model={model}
              pointEdit={pointEdit}
              onAnimateLayerClick={(layerId, propertyName) =>
                layerTimelineService.addBlockForProperty(layerId, propertyName)
              }
              onStartActionModeClick={() => {
                trackEvent('action_mode_start');
                if (model.model instanceof PathAnimationBlock) {
                  actionModeService.editMorph(model.model.id);
                }
              }}
              onDoneClick={() => bridge.stopPointEdit()}
            />
            <div className="spi-body fx-column fx-flex">
              {!model.inspectedProperties.length && (
                <div className="spi-empty fx-flex">No shared properties to view or edit</div>
              )}
              {sectionElements}
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
  pointEdit,
  onAnimateLayerClick,
  onStartActionModeClick,
  onDoneClick,
}: {
  model: PropertyInputModel;
  pointEdit: PointEditState | undefined;
  onAnimateLayerClick: (layerId: string, propertyName: string) => void;
  onStartActionModeClick: () => void;
  onDoneClick: () => void;
}) {
  const addTimelineBlockMenu = useMenu();
  const isStartActionModeDisabled = shouldDisableStartActionModeButton(model);
  return (
    <div className="spi-header mat-elevation-z2 ss-theme-transition fx-align-center fx-flex-none">
      <Icon className="spi-selection-icon" name={model.icon as IconName} />
      <div className="spi-selection-description-container fx-column fx-flex">
        <span className="spi-selection-description">{model.description}</span>
        <span className="spi-selection-sub-description">
          {pointEdit ? 'Editing points' : model.subDescription}
        </span>
      </div>
      {pointEdit && (
        <button type="button" className="spi-button spi-done-button" onClick={onDoneClick}>
          Done
        </button>
      )}
      {!pointEdit && shouldShowAnimateLayerButton(model) && (
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
                  onAnimateLayerClick(model.model.id, propertyName);
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

/** One property's field in a row: a text field, a color, a menu, or the easing curve. */
function PropertyField({
  field: { ip, label },
  ariaLabel,
  modelId,
  hasError,
  colorProps,
  onTextChange,
  onKeyDown,
  onBlur,
}: {
  field: InspectorField;
  ariaLabel: string;
  modelId: string | undefined;
  hasError: boolean;
  colorProps: { documentColors: readonly string[]; alphaMultiplier: number };
  onTextChange: (ip: InspectedProperty<any>, value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>, ip: InspectedProperty<any>) => void;
  onBlur: (ip: InspectedProperty<any>) => void;
}) {
  let content: ReactNode;
  if (!ip.isEditable()) {
    // Only show text if the property isn't inspectable.
    content = <span className="spi-property-value-static">{ip.getDisplayValue()}</span>;
  } else if (ip.typeName === 'EnumProperty') {
    content = <EnumPropertyEditor ip={ip} />;
  } else if (ip.typeName === 'InterpolatorProperty') {
    content = <InterpolatorEditor key={modelId} ip={ip} />;
  } else if (TEXT_INPUT_TYPE_NAMES.has(ip.typeName)) {
    content = (
      <>
        {ip.typeName === 'ColorProperty' && <ColorPropertyEditor ip={ip} {...colorProps} />}
        <input
          className={hasError ? 'has-input-error' : undefined}
          name={ip.propertyName}
          aria-label={ariaLabel}
          value={ip.editableValue ?? ''}
          onChange={event => onTextChange(ip, event.target.value)}
          onKeyDown={event => onKeyDown(event, ip)}
          onBlur={() => onBlur(ip)}
        />
      </>
    );
  }
  return (
    // Not a label, which would pass clicks on the curve editor on to its menu button.
    <div className={`spi-field spi-field-${ip.typeName}`}>
      {label && <span className="spi-field-label">{label}</span>}
      {content}
    </div>
  );
}

/**
 * The Path row, with a button that starts editing the points, and the path's text under
 * "Advanced", since it's rarely what's wanted and long.
 */
function PathRows({
  path,
  textField,
  canEditPoints,
  onEditPoints,
  isAdvancedOpen,
  onAdvancedToggle,
  animateButton,
}: {
  path: Path | undefined;
  textField: ReactNode;
  canEditPoints: boolean;
  onEditPoints: () => void;
  isAdvancedOpen: boolean;
  onAdvancedToggle: (isOpen: boolean) => void;
  animateButton: ReactNode;
}) {
  const count = path?.getSubPaths().length ?? 0;
  return (
    <>
      <div className="spi-row">
        <span className="spi-row-label">Path</span>
        <div className="spi-row-fields">
          {canEditPoints && (
            <button type="button" className="spi-button" onClick={onEditPoints}>
              Edit points
            </button>
          )}
          <span className="spi-row-note">
            {count ? `${count} ${count === 1 ? 'subpath' : 'subpaths'}` : 'Empty'}
          </span>
        </div>
        {animateButton}
      </div>
      <details
        className="spi-path-advanced"
        open={isAdvancedOpen}
        onToggle={event => onAdvancedToggle(event.currentTarget.open)}
      >
        <summary>Advanced</summary>
        <div className="spi-property spi-row">{textField}</div>
      </details>
    </>
  );
}

/**
 * The selected layer's bounds on the canvas at the current time, as the select tool shows them.
 * Typing a value moves the layer, or scales it from its top left corner, with its animation, as
 * one undo step (layoutValues.ts). It works without the canvas editor too.
 */
function LayoutSection({ layerId }: { layerId: string }) {
  const store = useEditorStore();
  const { layerTimelineService } = useServices();
  const layout = useAppSelector(
    state => getLayoutValues(getAnimatedVectorLayer(state).vl, layerId),
    areLayoutsEqual,
  );
  if (!layout) {
    return undefined;
  }
  const onCommit = (key: LayoutKey, value: number) => {
    const state = store.getState();
    const document = { vectorLayer: getVectorLayer(state), animation: getAnimation(state) };
    const rendered = getAnimatedVectorLayer(state).vl;
    const result = setLayoutValue(document, rendered, layerId, key, value);
    if (result) {
      layerTimelineService.commitCanvasEdit(result.vectorLayer, result.animation);
    }
  };
  const field = (key: LayoutKey, label: string, disabled = false) => (
    <NumberField
      label={label}
      ariaLabel={`Layout ${label}`}
      value={layout[key]}
      disabled={disabled}
      onCommit={value => onCommit(key, value)}
    />
  );
  return (
    <section className="spi-section spi-section-layout" aria-label="Layout">
      <div className="spi-section-title">Layout</div>
      <div className="spi-row">
        <span className="spi-row-label">Position</span>
        <div className="spi-row-fields">
          {field('x', 'X')}
          {field('y', 'Y')}
        </div>
      </div>
      <div className="spi-row">
        <span className="spi-row-label">Size</span>
        <div className="spi-row-fields">
          {/* A size of zero can't be scaled to anything else. */}
          {field('w', 'W', !layout.w)}
          {field('h', 'H', !layout.h)}
        </div>
      </div>
    </section>
  );
}

/**
 * The button at the end of a row whose properties can be animated. It adds a block for the row's
 * property at the current time, or opens a menu of the row's properties if it has several. Once a
 * property has blocks, the button marks it, and its menu says that the field shows the value from
 * before the first keyframe, since the inspector doesn't show values at the current time yet.
 */
function RowAnimateButton({
  row,
  onAnimate,
}: {
  row: InspectorRow;
  onAnimate: (propertyName: string) => void;
}) {
  const menu = useMenu();
  const { propertyNames, animatedPropertyNames } = row.animation ?? {
    propertyNames: [],
    animatedPropertyNames: [],
  };
  const isAnimated = animatedPropertyNames.length > 0;
  const [single] = propertyNames;
  const hasMenu = isAnimated || propertyNames.length > 1;
  const title = isAnimated ? 'Animated' : `Animate ${propertyNames.join(' and ')}`;
  return (
    <>
      <Tooltip title={title} placement="left">
        <button
          type="button"
          className={isAnimated ? 'spi-row-animate is-animated' : 'spi-row-animate'}
          aria-label={isAnimated ? `${propertyNames.join(' and ')} is animated` : title}
          aria-haspopup={hasMenu ? 'menu' : undefined}
          onClick={event => (hasMenu ? menu.openMenu(event) : onAnimate(single))}
        >
          <span className="spi-keyframe-diamond" />
        </button>
      </Tooltip>
      {hasMenu && (
        <Menu anchorEl={menu.anchorEl} open={menu.open} onClose={menu.closeMenu}>
          {isAnimated && (
            <MenuItem disabled className="spi-row-animate-note">
              Animated: this is the value before the first keyframe
            </MenuItem>
          )}
          {propertyNames.map(propertyName => (
            <MenuItem
              key={propertyName}
              onClick={() => {
                menu.closeMenu();
                onAnimate(propertyName);
              }}
            >
              {!animatedPropertyNames.includes(propertyName)
                ? `Animate ${propertyName}`
                : propertyNames.length > 1
                  ? `Add another ${propertyName} keyframe`
                  : 'Add another keyframe'}
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  );
}

function EnumPropertyEditor({ ip }: { ip: InspectedProperty<any> }) {
  const { options } = ip.property as EnumProperty;
  return (
    <MenuSelect
      label={ip.getDisplayValue()}
      options={options}
      onSelect={value => setValue(ip, value)}
    />
  );
}

/** Saves a value that was picked, rather than typed. */
function setValue(ip: InspectedProperty<any>, value: any) {
  ip.value = value;
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
