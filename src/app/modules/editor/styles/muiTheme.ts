import { blue, blueGrey, indigo, red } from '@mui/material/colors';
import { createTheme, type ThemeOptions } from '@mui/material/styles';

// These match the Angular Material palettes in theme.scss.
const sharedOptions: ThemeOptions = {
  typography: {
    fontFamily: "Roboto, 'Helvetica Neue', sans-serif",
  },
  components: {
    MuiIconButton: {
      defaultProps: { color: 'inherit' },
      // Angular Material's icon buttons didn't have a hover background.
      styleOverrides: { root: { '&:hover': { backgroundColor: 'transparent' } } },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: 14, minHeight: 48 },
      },
    },
    MuiSnackbar: {
      defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'center' } },
    },
    MuiTooltip: {
      defaultProps: {
        enterDelay: 500,
        enterNextDelay: 500,
        placement: 'bottom',
        disableInteractive: true,
      },
    },
  },
};

export const lightTheme = createTheme({
  ...sharedOptions,
  palette: {
    mode: 'light',
    primary: { main: blueGrey[500] },
    // Matches theme.scss's accent-text, which passes WCAG AA against the theme's own background
    // (blue.A400 only reached 3.98:1 against white).
    secondary: { main: blue.A700 },
    error: { main: red[500] },
  },
});

export const darkTheme = createTheme({
  ...sharedOptions,
  palette: {
    mode: 'dark',
    primary: { main: indigo[700] },
    // Matches theme.scss's accent-text (deepOrange.A200 only reached 2.78:1 against white).
    secondary: { main: blue[300] },
    error: { main: red[500] },
    background: { default: '#303030', paper: '#424242' },
  },
});
