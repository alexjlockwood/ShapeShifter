import { useEffect, useState } from 'react';

import type { CanvasEditorModule } from './CanvasEditorApi';
import { loadCanvasEditor } from './loadCanvasEditor';

/**
 * Returns the canvas editor's code once it has loaded, if it's turned on, e.g. for components of
 * its own that React renders. It's undefined until then, and if it fails to load, which the canvas
 * reports (CanvasController).
 */
export function useCanvasEditorModule(isEnabled: boolean) {
  const [editorModule, setEditorModule] = useState<CanvasEditorModule | undefined>(undefined);
  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    let isMounted = true;
    loadCanvasEditor().then(
      loaded => {
        if (isMounted) {
          setEditorModule(loaded);
        }
      },
      () => {},
    );
    return () => {
      isMounted = false;
    };
  }, [isEnabled]);
  return isEnabled ? editorModule : undefined;
}
