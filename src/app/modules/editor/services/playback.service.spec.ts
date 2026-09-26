import { VectorLayer } from 'app/modules/editor/model/layers';
import { Animation } from 'app/modules/editor/model/timeline';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { getCurrentTime, getIsPlaying } from 'app/modules/editor/store/playback/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { SetAnimation } from 'app/modules/editor/store/timeline/actions';

import { PlaybackService } from './playback.service';

describe('PlaybackService', () => {
  let store: Store<State>;
  let service: PlaybackService;

  beforeEach(() => {
    vi.useFakeTimers();
    store = createEditorStore();
    store.dispatch(new ResetWorkspace(new VectorLayer(), new Animation({ duration: 1000 })));
    service = new PlaybackService(store);
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  function currentTime() {
    return getCurrentTime(store.getState());
  }

  it('resumes slow motion playback from the current time (STORE-4)', () => {
    service.setCurrentTime(500);
    service.toggleIsSlowMotion();
    service.toggleIsPlaying();

    // The very first animation frame should still be close to 500, not jump down to a fifth of
    // it (100), which is what happens if the resume time isn't scaled by the playback speed.
    vi.advanceTimersByTime(16);
    expect(currentTime()).toBeGreaterThanOrEqual(500);
  });

  it('restarts each repeat from 0, not from where playback was resumed (STORE-8)', () => {
    service.toggleIsRepeating();
    service.setCurrentTime(500);
    service.toggleIsPlaying();

    // Run to the end of the 1000ms animation, then past the 750ms repeat delay and into the
    // first few frames of the next loop.
    vi.advanceTimersByTime(600);
    expect(currentTime()).toBe(1000);
    vi.advanceTimersByTime(766);
    expect(currentTime()).toBeLessThan(500);
  });

  it('plays from the start when the current time is past the (now shorter) duration (STORE-9)', () => {
    service.setCurrentTime(900);
    store.dispatch(new SetAnimation(new Animation({ duration: 300 })));
    service.toggleIsPlaying();

    vi.advanceTimersByTime(16);
    // Playback should still be running, having started over from 0, rather than stopping
    // immediately on the first frame at the (clamped) duration.
    expect(getIsPlaying(store.getState())).toBe(true);
    expect(currentTime()).toBeLessThan(300);
  });
});
