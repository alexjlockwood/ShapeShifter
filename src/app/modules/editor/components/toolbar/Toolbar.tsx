import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import { Icon, type IconName } from 'app/modules/editor/components/icons/Icon';
import { useServices } from 'app/modules/editor/context/EditorContext';
import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { useMenu } from 'app/modules/editor/hooks/useMenu';
import { trackEvent } from 'app/modules/editor/scripts/analytics';
import { getToolbarState } from 'app/modules/editor/store/actionmode/selectors';
import { getThemeType } from 'app/modules/editor/store/theme/selectors';
import { type MouseEvent, useMemo } from 'react';

import './toolbar.scss';
import { ToolbarData } from './ToolbarData';

export function Toolbar() {
  const { actionModeService, themeService } = useServices();
  const toolbarState = useAppSelector(getToolbarState);
  const isDarkTheme = useAppSelector(state => getThemeType(state).themeType === 'dark');
  const overflowMenu = useMenu();

  const toolbarData = useMemo(() => {
    const { mode, fromMl, toMl, selections, unpairedSubPath, block } = toolbarState;
    return new ToolbarData(mode, fromMl, toMl, selections, unpairedSubPath, block);
  }, [toolbarState]);

  const numSubPaths = toolbarData.getNumSubPaths();
  const numSegments = toolbarData.getNumSegments();
  const numPoints = toolbarData.getNumPoints();
  const showActionMode = toolbarData.shouldShowActionMode();
  const toolbarSubtitle = toolbarData.getToolbarSubtitle();
  const showAddPoints = numSubPaths > 0 || numSegments > 0 || !toolbarData.isSelectionMode();
  const showSplitSubPaths = showAddPoints;
  const showShiftSubPath = toolbarData.shouldShowShiftSubPath();

  // Wraps a click handler so that the click isn't also handled by the workspace.
  const onClick = (fn: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    fn();
  };

  const setDarkTheme = (isDark: boolean) => themeService.setTheme(isDark ? 'dark' : 'light');

  return (
    <div
      className={`toolbar mat-elevation-z2 ss-theme-transition fx-row fx-align-center${
        showActionMode ? ' is-action-mode' : ''
      }`}
    >
      {/* Shape Shifter logo. */}
      {!showActionMode && <Icon className="toolbar-logo" name="shapeshifter" />}

      {/* Action mode close button. */}
      {showActionMode && (
        <IconButton
          className="action-mode-close-icon"
          onClick={onClick(() => actionModeService.closeActionMode())}
        >
          <Icon name={toolbarData.isSelectionMode() ? 'arrow_back' : 'close'} />
        </IconButton>
      )}

      {/* Toolbar text. */}
      <div className="fx-column">
        <span className="toolbar-title">{toolbarData.getToolbarTitle()}</span>
        {toolbarSubtitle && <span className="toolbar-subtitle">{toolbarSubtitle}</span>}
      </div>

      <span className="fx-flex-auto" />

      {toolbarData.shouldShowAutoFix() && (
        <ActionButton
          title="Auto fix"
          icon="autofix"
          onClick={onClick(() => {
            trackEvent('Action mode', 'Auto fix click');
            actionModeService.autoFix();
          })}
        />
      )}

      {/* SubPath mode. */}
      {showAddPoints && (
        <ActionButton
          title="Add points (A)"
          icon="add_circle_outline"
          isActivated={toolbarData.isAddPointsMode()}
          onClick={onClick(() => {
            trackEvent('Action mode', 'Add points');
            actionModeService.toggleSplitCommandsMode();
          })}
        />
      )}
      {showSplitSubPaths && (
        <ActionButton
          title="Split subpaths (S)"
          icon="content_cut"
          isActivated={toolbarData.isSplitSubPathsMode()}
          onClick={onClick(() => {
            trackEvent('Action mode', 'Split sub paths');
            actionModeService.toggleSplitSubPathsMode();
          })}
        />
      )}
      {toolbarData.shouldShowPairSubPaths() && (
        <ActionButton
          title="Pair subpaths (D)"
          icon="compare_arrows"
          isActivated={toolbarData.isPairSubPathsMode()}
          onClick={onClick(() => {
            trackEvent('Action mode', 'Pair sub paths');
            actionModeService.togglePairSubPathsMode();
          })}
        />
      )}
      {numSubPaths === 1 && (
        <ActionButton
          title="Reverse points (R)"
          icon="reverse"
          isDisabled={!toolbarData.isSelectionMode()}
          onClick={onClick(() => actionModeService.reverseSelectedSubPaths())}
        />
      )}
      {showShiftSubPath && (
        <ActionButton
          title="Shift back points (B)"
          icon="skip_previous"
          isDisabled={!toolbarData.isSelectionMode()}
          onClick={onClick(() => actionModeService.shiftBackSelectedSubPaths())}
        />
      )}
      {showShiftSubPath && (
        <ActionButton
          title="Shift forward points (F)"
          icon="skip_next"
          isDisabled={!toolbarData.isSelectionMode()}
          onClick={onClick(() => actionModeService.shiftForwardSelectedSubPaths())}
        />
      )}
      {toolbarData.getNumSplitSubPaths() > 0 && (
        <ActionButton
          title={`Delete subpath${numSubPaths === 1 ? '' : 's'}`}
          icon="delete"
          onClick={onClick(() => actionModeService.deleteSelectedActionModeModels())}
        />
      )}

      {/* Segment mode. */}
      {numSegments > 0 && (
        <ActionButton
          title={`Delete segment${numSegments === 1 ? '' : 's'}`}
          icon="delete"
          onClick={onClick(() => actionModeService.deleteSelectedActionModeModels())}
        />
      )}

      {/* Point mode. */}
      {toolbarData.shouldShowSplitInHalf() && (
        <Tooltip title="Add point (A)">
          <IconButton
            onMouseEnter={() => actionModeService.splitInHalfHover()}
            onMouseLeave={() => actionModeService.clearHover()}
            onClick={onClick(() => actionModeService.splitSelectedPointInHalf())}
          >
            <Icon name="add_circle_outline" />
          </IconButton>
        </Tooltip>
      )}
      {toolbarData.shouldShowSetFirstPosition() && (
        <ActionButton
          title="Set first point (F)"
          icon="looks_one"
          onClick={onClick(() => actionModeService.shiftPointToFront())}
        />
      )}
      {toolbarData.getNumSplitPoints() > 0 && (
        <ActionButton
          title={`Delete point${numPoints === 1 ? '' : 's'}`}
          icon="delete"
          onClick={onClick(() => actionModeService.deleteSelectedActionModeModels())}
        />
      )}

      {/* Overflow menu. */}
      <IconButton
        className="toolbar-action-button"
        aria-label="More options"
        onClick={event => {
          event.stopPropagation();
          overflowMenu.openMenu(event);
        }}
      >
        <Icon name="more_vert" />
      </IconButton>
      <Menu
        className="toolbar-overflow-menu"
        anchorEl={overflowMenu.anchorEl}
        open={overflowMenu.open}
        onClose={overflowMenu.closeMenu}
      >
        <MenuItem
          onClick={() => {
            setDarkTheme(!isDarkTheme);
            overflowMenu.closeMenu();
          }}
        >
          <Switch
            className="toolbar-dark-theme-switch"
            size="small"
            color="secondary"
            checked={isDarkTheme}
            onClick={event => event.stopPropagation()}
            onChange={event => setDarkTheme(event.target.checked)}
          />
          <span>Dark theme</span>
        </MenuItem>
        <OverflowLink
          href="http://www.androiddesignpatterns.com/2016/11/introduction-to-icon-animation-techniques.html"
          icon="info"
          label="Getting started"
          onClick={() => {
            trackEvent('Miscellaneous', 'Getting started click');
            overflowMenu.closeMenu();
          }}
        />
        <OverflowLink
          href="https://github.com/alexjlockwood/ShapeShifter"
          icon="contribute"
          label="Contribute"
          onClick={() => {
            trackEvent('Miscellaneous', 'Contribute click');
            overflowMenu.closeMenu();
          }}
        />
        <OverflowLink
          href="https://github.com/alexjlockwood/ShapeShifter/issues"
          icon="bug_report"
          label="Send feedback"
          onClick={() => {
            trackEvent('Miscellaneous', 'Send feedback click');
            overflowMenu.closeMenu();
          }}
        />
      </Menu>
    </div>
  );
}

interface ActionButtonProps {
  readonly title: string;
  readonly icon: IconName;
  readonly onClick: (event: MouseEvent) => void;
  readonly isActivated?: boolean;
  readonly isDisabled?: boolean;
}

function ActionButton({ title, icon, onClick, isActivated, isDisabled }: ActionButtonProps) {
  const button = (
    <IconButton
      className={`toolbar-action-button${isActivated ? ' activated' : ''}`}
      aria-label={title}
      disabled={isDisabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </IconButton>
  );
  // Tooltips need a wrapper element to show up on disabled buttons.
  return (
    <Tooltip title={title}>{isDisabled === undefined ? button : <span>{button}</span>}</Tooltip>
  );
}

interface OverflowLinkProps {
  readonly href: string;
  readonly icon: IconName;
  readonly label: string;
  readonly onClick: () => void;
}

function OverflowLink({ href, icon, label, onClick }: OverflowLinkProps) {
  return (
    <MenuItem component="a" href={href} target="_blank" rel="noopener" onClick={onClick}>
      <ListItemIcon>
        <Icon name={icon} />
      </ListItemIcon>
      <ListItemText>{label}</ListItemText>
    </MenuItem>
  );
}
