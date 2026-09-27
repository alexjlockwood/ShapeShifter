import Button from '@mui/material/Button';
import { Tip } from 'app/modules/editor/components/common/Tip';
import { Icon, type IconName } from 'app/modules/editor/components/icons/Icon';
import { useServices } from 'app/modules/editor/context/EditorContext';
import { trackEvent } from 'app/modules/editor/scripts/analytics';
import type { MouseEvent } from 'react';

import './actionbar.scss';
import { useToolbarData } from './useToolbarData';

/**
 * The floating bar of action mode's commands, under the canvases. Each button has an icon and a
 * label, and its tooltip has the shortcut.
 */
export function ActionBar() {
  const { actionModeService } = useServices();
  const { toolbarData, status } = useToolbarData();
  if (!toolbarData.shouldShowActionMode()) {
    return null;
  }

  const numSubPaths = toolbarData.getNumSubPaths();
  const numSegments = toolbarData.getNumSegments();
  const numPoints = toolbarData.getNumPoints();
  const showAddPoints = numSubPaths > 0 || numSegments > 0 || !toolbarData.isSelectionMode();
  const showShiftSubPath = toolbarData.shouldShowShiftSubPath();
  const isSelectionMode = toolbarData.isSelectionMode();
  // The status strip offers auto fix when the paths don't morph.
  const showAutoFix = toolbarData.shouldShowAutoFix() && !status?.canAutoFix;

  return (
    <div
      className="action-bar mat-elevation-z4 ss-theme-transition"
      role="toolbar"
      aria-label="Morph editor"
      // Clicks on the bar shouldn't also clear the selection.
      onClick={event => event.stopPropagation()}
    >
      {showAutoFix && (
        <ActionButton
          name="Auto fix"
          label="Auto fix"
          icon="autofix"
          onClick={() => {
            trackEvent('action_mode_auto_fix');
            actionModeService.autoFix();
          }}
        />
      )}

      {/* SubPath mode. */}
      {showAddPoints && (
        <ActionButton
          name="Add points (A)"
          label="Add points"
          icon="add_circle_outline"
          isActivated={toolbarData.isAddPointsMode()}
          onClick={() => {
            trackEvent('action_mode_add_points');
            actionModeService.toggleSplitCommandsMode();
          }}
        />
      )}
      {showAddPoints && (
        <ActionButton
          name="Split subpaths (S)"
          label="Split subpaths"
          icon="content_cut"
          isActivated={toolbarData.isSplitSubPathsMode()}
          onClick={() => {
            trackEvent('action_mode_split_subpaths');
            actionModeService.toggleSplitSubPathsMode();
          }}
        />
      )}
      {toolbarData.shouldShowPairSubPaths() && (
        <ActionButton
          name="Pair subpaths (D)"
          label="Pair subpaths"
          icon="compare_arrows"
          isActivated={toolbarData.isPairSubPathsMode()}
          onClick={() => {
            trackEvent('action_mode_pair_subpaths');
            actionModeService.togglePairSubPathsMode();
          }}
        />
      )}
      {numSubPaths === 1 && (
        <ActionButton
          name="Reverse points (R)"
          label="Reverse"
          icon="reverse"
          isDisabled={!isSelectionMode}
          onClick={() => actionModeService.reverseSelectedSubPaths()}
        />
      )}
      {showShiftSubPath && (
        <ActionButton
          name="Shift back points (B)"
          label="Shift back"
          icon="skip_previous"
          isDisabled={!isSelectionMode}
          onClick={() => actionModeService.shiftBackSelectedSubPaths()}
        />
      )}
      {showShiftSubPath && (
        <ActionButton
          name="Shift forward points (F)"
          label="Shift forward"
          icon="skip_next"
          isDisabled={!isSelectionMode}
          onClick={() => actionModeService.shiftForwardSelectedSubPaths()}
        />
      )}
      {toolbarData.getNumSplitSubPaths() > 0 && (
        <ActionButton
          name={`Delete subpath${numSubPaths === 1 ? '' : 's'}`}
          label="Delete"
          shortcut="Delete"
          icon="delete"
          onClick={() => actionModeService.deleteSelectedActionModeModels()}
        />
      )}

      {/* Segment mode. */}
      {numSegments > 0 && (
        <ActionButton
          name={`Delete segment${numSegments === 1 ? '' : 's'}`}
          label="Delete"
          shortcut="Delete"
          icon="delete"
          onClick={() => actionModeService.deleteSelectedActionModeModels()}
        />
      )}

      {/* Point mode. */}
      {toolbarData.shouldShowSplitInHalf() && (
        <ActionButton
          name="Add point (A)"
          label="Add point"
          icon="add_circle_outline"
          onMouseEnter={() => actionModeService.splitInHalfHover()}
          onMouseLeave={() => actionModeService.clearHover()}
          onClick={() => actionModeService.splitSelectedPointInHalf()}
        />
      )}
      {toolbarData.shouldShowSetFirstPosition() && (
        <ActionButton
          name="Set first point (F)"
          label="Set first point"
          icon="looks_one"
          onClick={() => actionModeService.shiftPointToFront()}
        />
      )}
      {toolbarData.getNumSplitPoints() > 0 && (
        <ActionButton
          name={`Delete point${numPoints === 1 ? '' : 's'}`}
          label="Delete"
          shortcut="Delete"
          icon="delete"
          onClick={() => actionModeService.deleteSelectedActionModeModels()}
        />
      )}
    </div>
  );
}

interface ActionButtonProps {
  /**
   * The accessible name, which the end-to-end tests find the button by. It ends with the
   * shortcut in parentheses, if there is one, unless the shortcut is given separately.
   */
  readonly name: string;
  /** The visible label. */
  readonly label: string;
  /** The shortcut, for the tooltip, when the name doesn't have it. */
  readonly shortcut?: string;
  readonly icon: IconName;
  readonly onClick: () => void;
  readonly onMouseEnter?: () => void;
  readonly onMouseLeave?: () => void;
  readonly isActivated?: boolean;
  readonly isDisabled?: boolean;
}

function ActionButton({
  name,
  label,
  shortcut,
  icon,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isActivated,
  isDisabled,
}: ActionButtonProps) {
  return (
    <Tip title={shortcut ? `${name} (${shortcut})` : name} disabled={isDisabled}>
      <Button
        className={`action-bar-button${isActivated ? ' activated' : ''}`}
        aria-label={name}
        aria-pressed={isActivated === undefined ? undefined : isActivated}
        disabled={isDisabled}
        startIcon={<Icon name={icon} />}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          onClick();
        }}
      >
        {label}
      </Button>
    </Tip>
  );
}
