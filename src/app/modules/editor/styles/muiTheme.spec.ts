import { darkTheme, lightTheme } from './muiTheme';

describe('muiTheme', () => {
  // Angular's tooltips waited half a second, and some tooltips use MUI's Tooltip directly (e.g. the
  // playback controls), relying on the theme rather than MUI's 100 ms default.
  it('delays every tooltip like the Angular app did', () => {
    for (const theme of [lightTheme, darkTheme]) {
      const defaultProps = theme.components?.MuiTooltip?.defaultProps;
      expect(defaultProps?.enterDelay).toBe(500);
      expect(defaultProps?.enterNextDelay).toBe(500);
    }
  });
});
