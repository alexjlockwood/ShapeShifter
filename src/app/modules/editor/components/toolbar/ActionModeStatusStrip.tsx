import Button from '@mui/material/Button';
import { Icon } from 'app/modules/editor/components/icons/Icon';
import { useServices } from 'app/modules/editor/context/EditorContext';
import { trackEvent } from 'app/modules/editor/scripts/analytics';

import './actionbar.scss';
import { useToolbarData } from './useToolbarData';

/**
 * Says whether the morph works in action mode, and if it doesn't, why not, with auto fix and the
 * next step. It's above the canvases.
 */
export function ActionModeStatusStrip() {
  const { actionModeService } = useServices();
  const { status } = useToolbarData();
  if (!status) {
    return null;
  }
  const { morphs, summary, hint, canAutoFix } = status;
  return (
    <div
      className={`action-mode-status ss-theme-transition ${morphs ? 'is-morphable' : 'is-broken'}`}
      role="status"
      // Clicks on the strip shouldn't also clear the selection.
      onClick={event => event.stopPropagation()}
    >
      <Icon className="action-mode-status-icon" name={morphs ? 'check_circle' : 'error'} />
      <span className="action-mode-status-summary">{summary}</span>
      {canAutoFix && (
        <Button
          className="action-mode-status-auto-fix"
          size="small"
          startIcon={<Icon name="autofix" />}
          onClick={() => {
            trackEvent('action_mode_auto_fix');
            actionModeService.autoFix();
          }}
        >
          Auto fix
        </Button>
      )}
      {hint && <span className="action-mode-status-hint">{hint}</span>}
    </div>
  );
}
