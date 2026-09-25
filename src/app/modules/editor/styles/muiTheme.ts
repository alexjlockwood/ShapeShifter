import { blue, blueGrey, deepOrange, indigo, red } from '@mui/material/colors';
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
    secondary: { main: blue.A400 },
    error: { main: red[500] },
  },
});

export const darkTheme = createTheme({
  ...sharedOptions,
  palette: {
    mode: 'dark',
    primary: { main: indigo[700] },
    secondary: { main: deepOrange.A200 },
    error: { main: red[500] },
    background: { default: '#303030', paper: '#424242' },
  },
});
