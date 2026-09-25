import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Icon } from 'app/modules/editor/components/icons/Icon';
import { useServices } from 'app/modules/editor/context/EditorContext';
import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import { getPlaybackControlsState } from 'app/modules/editor/store/playback/selectors';
import type { MouseEvent } from 'react';

import './playback.scss';

export function Playback() {
  const { playbackService } = useServices();
  const { isSlowMotion, isPlaying, isRepeating } = useAppSelector(getPlaybackControlsState);

  const onClick = (fn: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    fn();
  };

  return (
    <div className="playback fx-row fx-align-center">
      <span className="fx-flex" />
      <Tooltip title="Slow motion (S)">
        <IconButton
          className="slow-motion-button"
          onClick={onClick(() => playbackService.toggleIsSlowMotion())}
        >
          <Icon name="slow_motion_video" className={isSlowMotion ? 'activated' : undefined} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Rewind (Left)">
        <IconButton onClick={onClick(() => playbackService.rewind())}>
          <Icon name="skip_previous" />
        </IconButton>
      </Tooltip>
      <Tooltip title={`${isPlaying ? 'Pause' : 'Play'} (Spacebar)`}>
        <Fab
          size="small"
          color="secondary"
          onClick={onClick(() => playbackService.toggleIsPlaying())}
        >
          <div className={`play-pause-icon can-animate${isPlaying ? ' is-playing' : ''}`} />
        </Fab>
      </Tooltip>
      <Tooltip title="Fast forward (Right)">
        <IconButton onClick={onClick(() => playbackService.fastForward())}>
          <Icon name="skip_next" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Repeat (R)">
        <IconButton
          className="repeating-button"
          onClick={onClick(() => playbackService.toggleIsRepeating())}
        >
          <Icon name="repeat" className={isRepeating ? 'activated' : undefined} />
        </IconButton>
      </Tooltip>
      <span className="fx-flex" />
    </div>
  );
}
