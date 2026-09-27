import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrastRatio';

describe('contrastRatio', () => {
  it('is 21 for black on white, and 1 for a color on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#2962ff', '#2962ff')).toBe(1);
  });

  it('is the same either way round', () => {
    expect(contrastRatio('#000', '#fff')).toBe(contrastRatio('#fff', '#000'));
  });
});

// WCAG 2.1 success criteria 1.4.3 (text, 4.5:1) and 1.4.11 (icons and other graphics, 3:1). Every
// pair below is a place the app draws one fixed color on another; each comment points at the
// source line(s) that set the two colors so a future change can find this test.
const TEXT = 4.5;
const GRAPHIC = 3;

// styles/theme.scss's light and dark theme backgrounds that a themed color sits on, since the
// pairs below aren't all against plain white or black.
const BASE100_LIGHT = '#f5f5f5'; // $ss-light-theme-background's base100 (grey 100).
const BASE100_DARK = '#424242'; // $ss-dark-theme-background's base100 (grey 800).
const DIALOG_PAPER_LIGHT = '#ffffff'; // MUI's default light background.paper.
const DIALOG_PAPER_DARK = '#424242'; // styles/muiTheme.ts's dark theme background.paper.
// MUI's SnackbarContent inverts the app's own background (emphasize(background.default, ...)),
// so the light theme's snackbar is dark and the dark theme's is light.
const SNACKBAR_BG_LIGHT_THEME = '#323232';
const SNACKBAR_BG_DARK_THEME = '#fafafa';

const pairs: Array<{ name: string; a: string; b: string; min: number }> = [
  {
    name: 'action-mode activated icon (components/toolbar/_toolbar-theme.scss, button.activated)',
    a: '#ffffff',
    b: '#2962ff', // accent-fill
    min: GRAPHIC,
  },
  {
    name: 'action bar text (components/toolbar/_toolbar-theme.scss, .toolbar.is-action-mode)',
    a: '#ffffff',
    b: '#2962ff', // accent-fill
    min: TEXT,
  },
  {
    name: 'app bar, light theme (styles/theme.scss $light-theme primary, blue-grey 700)',
    a: '#ffffff',
    b: '#455a64',
    min: TEXT,
  },
  {
    name: 'app bar, dark theme (styles/theme.scss $dark-theme primary, indigo 700)',
    a: '#ffffff',
    b: '#303f9f',
    min: TEXT,
  },
  {
    name: 'selected layer row (components/layertimeline/_layerlisttree-theme.scss, .is-selected)',
    a: '#ffffff',
    b: '#2962ff', // accent-fill
    min: TEXT,
  },
  {
    name:
      'selected animation header (components/layertimeline/_layertimeline-theme.scss, ' +
      '.slt-timeline-animation-meta.is-selected)',
    a: '#ffffff',
    b: '#2962ff', // accent-fill
    min: TEXT,
  },
  {
    name: 'dialog buttons, light theme (components/dialogs/_dialog-theme.scss, accent-text)',
    a: '#2962ff',
    b: DIALOG_PAPER_LIGHT,
    min: TEXT,
  },
  {
    name: 'dialog buttons, dark theme (components/dialogs/_dialog-theme.scss, accent-text)',
    a: '#64b5f6',
    b: DIALOG_PAPER_DARK,
    min: TEXT,
  },
  {
    name: 'snackbar action, light theme (styles/theme.scss)',
    a: '#64b5f6',
    b: SNACKBAR_BG_LIGHT_THEME,
    min: TEXT,
  },
  {
    name: 'snackbar action, dark theme (styles/theme.scss)',
    a: '#2962ff',
    b: SNACKBAR_BG_DARK_THEME,
    min: TEXT,
  },
  {
    name: 'active playback icon (components/playback/_playback-theme.scss, .ss-icon.activated)',
    a: '#e65100', // orange 900
    b: '#ffffff',
    min: GRAPHIC,
  },
  {
    name: 'play button, both themes (components/playback/_playback-theme.scss, .MuiFab-root)',
    a: '#ffffff',
    b: '#2962ff', // accent-fill
    min: GRAPHIC,
  },
  {
    name:
      'pressed editor tool, and the editor label pills (components/canvas/_canvas-theme.scss, ' +
      "components/canvaseditor/EditorRenderer.ts's EDITOR_COLOR)",
    a: '#ffffff',
    b: '#0a73bf',
    min: TEXT,
  },
  {
    name: "editor label pills (components/canvaseditor/EditorRenderer.ts's GUIDE_COLOR)",
    a: '#ffffff',
    b: '#bf360c',
    min: TEXT,
  },
  {
    name: "editor label pills (components/canvaseditor/EditorRenderer.ts's RULER_GUIDE_COLOR)",
    a: '#ffffff',
    b: '#c23290',
    min: TEXT,
  },
  {
    name:
      'active editor setting, light theme (components/canvas/_canvas-theme.scss, ' +
      '[data-setting][aria-pressed], blue 800)',
    a: '#1565c0',
    b: BASE100_LIGHT,
    min: GRAPHIC,
  },
  {
    name:
      'active editor setting, dark theme (components/canvas/_canvas-theme.scss, ' +
      '[data-setting][aria-pressed], accent-text)',
    a: '#64b5f6',
    b: BASE100_DARK,
    min: GRAPHIC,
  },
  {
    name: 'split-point numbers (components/canvas/CanvasOverlay.ts, SPLIT_POINT_COLOR)',
    a: '#ffffff',
    b: '#bf360c',
    min: TEXT,
  },
  {
    name: 'error-point numbers (components/canvas/CanvasOverlay.ts, ERROR_COLOR)',
    a: '#ffffff',
    b: '#c62828',
    min: TEXT,
  },
  {
    name: 'morphable keyframe badge, light theme (components/canvas/_canvas-theme.scss, green 800)',
    a: '#2e7d32',
    b: BASE100_LIGHT,
    min: TEXT,
  },
  {
    name: 'morphable keyframe badge, dark theme (components/canvas/_canvas-theme.scss, green A200)',
    a: '#69f0ae',
    b: BASE100_DARK,
    min: TEXT,
  },
  {
    name: 'broken keyframe badge, light theme (components/canvas/_canvas-theme.scss, deep orange 900)',
    a: '#bf360c',
    b: BASE100_LIGHT,
    min: TEXT,
  },
  {
    name: 'broken keyframe badge, dark theme (components/canvas/_canvas-theme.scss, deep orange 200)',
    a: '#ffab91',
    b: BASE100_DARK,
    min: TEXT,
  },
];

describe('the app colors that need to pass WCAG AA', () => {
  it.each(pairs)('$name', ({ a, b, min }) => {
    expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(min);
  });
});
