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
          <Button color="secondary" size="small" onClick={() => snackBarService.dismiss()}>
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
