import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { getToolbarState } from 'app/modules/editor/store/actionmode/selectors';
import { useMemo } from 'react';

import { getActionModeStatus } from './actionModeStatus';
import { ToolbarData } from './ToolbarData';

/**
 * Returns what the app bar, the action bar, and the status strip show for the current action mode
 * and selections.
 */
export function useToolbarData() {
  const toolbarState = useAppSelector(getToolbarState);
  return useMemo(() => {
    const { mode, fromMl, toMl, selections, unpairedSubPath, block } = toolbarState;
    const toolbarData = new ToolbarData(mode, fromMl, toMl, selections);
    const status = getActionModeStatus({
      mode,
      block,
      layer: fromMl,
      unpairedSubPathSource: unpairedSubPath?.source,
      hasSelections: toolbarData.getNumSelections() > 0,
    });
    return { toolbarData, status };
  }, [toolbarState]);
}
