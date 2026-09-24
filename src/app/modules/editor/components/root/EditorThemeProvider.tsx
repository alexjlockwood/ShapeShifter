import { ThemeProvider } from '@mui/material/styles';
import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { getThemeType } from 'app/modules/editor/store/theme/selectors';
import { darkTheme, lightTheme } from 'app/modules/editor/styles/muiTheme';
import { type ReactNode, useLayoutEffect } from 'react';

/** Applies the current theme, both to MUI components and to the app's own styles. */
export function EditorThemeProvider({ children }: { children: ReactNode }) {
  const { themeType } = useAppSelector(getThemeType);
  useLayoutEffect(() => {
    // Set on the body so that it also applies to menus and dialogs.
    document.body.classList.toggle('ss-dark-theme', themeType === 'dark');
  }, [themeType]);
  return (
    <ThemeProvider theme={themeType === 'dark' ? darkTheme : lightTheme}>{children}</ThemeProvider>
  );
}
