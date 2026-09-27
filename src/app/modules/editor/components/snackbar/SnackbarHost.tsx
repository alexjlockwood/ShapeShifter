import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { useServices } from 'app/modules/editor/context/EditorContext';
import { useState, useSyncExternalStore } from 'react';

/** Shows the message requested through the SnackBarService, if any. */
export function SnackbarHost() {
  const { snackBarService } = useServices();
  const snackBar = useSyncExternalStore(snackBarService.subscribe, snackBarService.getSnackBar);

  // Keep showing the last message while it animates closed.
  const [shownSnackBar, setShownSnackBar] = useState(snackBar);
  if (snackBar && snackBar !== shownSnackBar) {
    setShownSnackBar(snackBar);
  }
  if (!shownSnackBar) {
    return undefined;
  }
  return (
    <Snackbar
      // A new message replaces the current one instead of animating in after it.
      key={shownSnackBar.key}
      open={snackBar === shownSnackBar}
      autoHideDuration={shownSnackBar.duration}
      message={shownSnackBar.message}
      action={
        shownSnackBar.action && (
          <Button
            size="small"
            // MUI's Snackbar always uses the opposite of the app's background (see
            // SnackbarContent's use of emphasize()), so it needs the other theme's accent-text
            // token rather than the current theme's secondary color: theme.palette.secondary.main
            // (blue.A700 in light, blue[300] in dark; see styles/muiTheme.ts) is only 2.62:1 /
            // 2.12:1 against the snackbar's own inverted background.
            sx={{ color: theme => (theme.palette.mode === 'light' ? '#64B5F6' : '#2962FF') }}
            onClick={() => snackBarService.clickAction(shownSnackBar)}
          >
            {shownSnackBar.action}
          </Button>
        )
      }
      onClose={(_, reason) => {
        if (reason !== 'clickaway') {
          snackBarService.dismiss();
        }
      }}
      slotProps={{ transition: { onExited: () => setShownSnackBar(undefined) } }}
    />
  );
}
