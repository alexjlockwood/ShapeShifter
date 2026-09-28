import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import { Tip } from 'app/modules/editor/components/common/Tip';
import { Icon, type IconName } from 'app/modules/editor/components/icons/Icon';
import { useServices } from 'app/modules/editor/context/EditorContext';
import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { useMenu } from 'app/modules/editor/hooks/useMenu';
import { ActionMode } from 'app/modules/editor/model/actionmode';
import { trackEvent } from 'app/modules/editor/scripts/analytics';
import { getThemeType } from 'app/modules/editor/store/theme/selectors';
import {
  getBuildFeatures,
  getCanvasEditorResetSearch,
  isCanvasEditorPreview,
} from 'environments/features';
import { type MouseEvent } from 'react';

import './toolbar.scss';
import { useToolbarData } from './useToolbarData';

export function Toolbar() {
  const { actionModeService, themeService, features } = useServices();
  const { toolbarData } = useToolbarData();
  const isDarkTheme = useAppSelector(state => getThemeType(state).themeType === 'dark');
  const overflowMenu = useMenu();
  const showActionMode = toolbarData.shouldShowActionMode();
  const isEditorPreview = isCanvasEditorPreview(features, getBuildFeatures(import.meta.env));

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
          aria-label={toolbarData.isSelectionMode() ? 'Back' : 'Close mode'}
          onClick={onClick(() => actionModeService.closeActionMode())}
        >
          <Icon name={toolbarData.isSelectionMode() ? 'arrow_back' : 'close'} />
        </IconButton>
      )}

      {/* Toolbar text. The status strip under it says what to do next in action mode. */}
      <span className="toolbar-title">{toolbarData.getToolbarTitle()}</span>

      <span className="fx-flex-auto" />

      {showActionMode && (
        <Tip title="Leave the morph editor" describeChild>
          <Button
            className="toolbar-done-button"
            color="inherit"
            onClick={onClick(() => actionModeService.setActionMode(ActionMode.None))}
          >
            Done
          </Button>
        </Tip>
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
        {isEditorPreview && (
          <MenuItem
            onClick={() => {
              trackEvent('turn_off_canvas_editor');
              overflowMenu.closeMenu();
              // The features are resolved once per page load (src/main.tsx), so this reloads.
              // Unsaved work still gets the usual prompt before the page is left.
              window.location.search = getCanvasEditorResetSearch(window.location.search);
            }}
          >
            <ListItemIcon>
              <Icon name="block" />
            </ListItemIcon>
            <ListItemText>Turn off the canvas editor preview</ListItemText>
          </MenuItem>
        )}
        <OverflowLink
          href="http://www.androiddesignpatterns.com/2016/11/introduction-to-icon-animation-techniques.html"
          icon="info"
          label="Getting started"
          onClick={() => {
            trackEvent('open_getting_started');
            overflowMenu.closeMenu();
          }}
        />
        <OverflowLink
          href="https://github.com/alexjlockwood/ShapeShifter"
          icon="contribute"
          label="Contribute"
          onClick={() => {
            trackEvent('open_contribute');
            overflowMenu.closeMenu();
          }}
        />
        <OverflowLink
          href="https://github.com/alexjlockwood/ShapeShifter/issues"
          icon="bug_report"
          label="Send feedback"
          onClick={() => {
            trackEvent('send_feedback');
            overflowMenu.closeMenu();
          }}
        />
      </Menu>
    </div>
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
