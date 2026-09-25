import { ActionMode } from 'app/modules/editor/model/actionmode';

import { ToolbarData } from './ToolbarData';

describe('ToolbarData', () => {
  it('has no subtitle in selection mode when no path block is selected', () => {
    const data = new ToolbarData(
      ActionMode.Selection,
      undefined,
      undefined,
      [],
      undefined,
      undefined,
    );
    expect(data.getToolbarTitle()).toBe('Edit path morphing animation');
    expect(data.getToolbarSubtitle()).toBe('');
  });
});
