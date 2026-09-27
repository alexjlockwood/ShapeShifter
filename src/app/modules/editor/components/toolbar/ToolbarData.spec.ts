import { ActionMode } from 'app/modules/editor/model/actionmode';

import { ToolbarData } from './ToolbarData';

describe('ToolbarData', () => {
  it('has a title in selection mode when nothing is selected', () => {
    const data = new ToolbarData(ActionMode.Selection, undefined, undefined, []);
    expect(data.getToolbarTitle()).toBe('Edit path morphing animation');
    expect(data.shouldShowAutoFix()).toBe(true);
  });
});
