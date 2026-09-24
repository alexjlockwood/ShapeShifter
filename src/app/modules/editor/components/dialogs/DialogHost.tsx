import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { useServices } from 'app/modules/editor/context/EditorContext';
import { DEMO_INFOS, type DemoInfo } from 'app/modules/editor/scripts/demos';
import { useState, useSyncExternalStore } from 'react';

import { type DialogRequest, DropFilesAction } from './dialog.service';
import './dialogs.scss';

/** Shows the dialog requested through the DialogService, if any. */
export function DialogHost() {
  const { dialogService } = useServices();
  const request = useSyncExternalStore(dialogService.subscribe, dialogService.getRequest);

  // Keep showing the last dialog while it animates closed.
  const [shownRequest, setShownRequest] = useState(request);
  if (request && request !== shownRequest) {
    setShownRequest(request);
  }
  if (!shownRequest) {
    return undefined;
  }
  return (
    <Dialog
      className="ss-dialog"
      open={request === shownRequest}
      onClose={() => shownRequest.close()}
      slotProps={{ transition: { onExited: () => setShownRequest(undefined) } }}
    >
      <DialogContents request={shownRequest} />
    </Dialog>
  );
}

function DialogContents({ request }: { request: DialogRequest }) {
  switch (request.type) {
    case 'confirm':
      return (
        <>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogContent>
            <DialogContentText>{request.message}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button color="secondary" onClick={() => request.close()}>
              Cancel
            </Button>
            <Button color="secondary" autoFocus onClick={() => request.close(true)}>
              OK
            </Button>
          </DialogActions>
        </>
      );
    case 'pickDemo':
      return <DemoDialogContents close={request.close} />;
    case 'dropFiles':
      return (
        <>
          <DialogTitle>Start from scratch?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Do you want to start from scratch or add the imported layers to the existing
              animation?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button color="secondary" onClick={() => request.close()}>
              Cancel
            </Button>
            <Button color="secondary" onClick={() => request.close(DropFilesAction.ResetWorkspace)}>
              Start from scratch
            </Button>
            <Button
              color="secondary"
              autoFocus
              onClick={() => request.close(DropFilesAction.AddToWorkspace)}
            >
              Add layers
            </Button>
          </DialogActions>
        </>
      );
  }
}

function DemoDialogContents({ close }: { close: (demoInfo?: DemoInfo) => void }) {
  const [selectedDemoId, setSelectedDemoId] = useState(DEMO_INFOS[0].id);
  return (
    <>
      <DialogTitle>Choose a demo</DialogTitle>
      <DialogContent>
        <RadioGroup
          value={selectedDemoId}
          onChange={event => setSelectedDemoId(event.target.value)}
        >
          {DEMO_INFOS.map(demoInfo => (
            <FormControlLabel
              key={demoInfo.id}
              value={demoInfo.id}
              control={<Radio color="secondary" />}
              label={demoInfo.title}
            />
          ))}
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button color="secondary" onClick={() => close()}>
          Cancel
        </Button>
        <Button
          color="secondary"
          autoFocus
          onClick={() => close(DEMO_INFOS.find(demoInfo => demoInfo.id === selectedDemoId))}
        >
          OK
        </Button>
      </DialogActions>
    </>
  );
}
