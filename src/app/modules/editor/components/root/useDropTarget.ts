import { type DragEvent, useEffect, useRef, useState } from 'react';

/**
 * Handles files dropped onto an element. Returns whether files are being dragged over it,
 * along with the event handlers to attach to it.
 */
export function useDropTarget(onDropFiles: (files: FileList) => void) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const notDraggingTimeoutId = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(notDraggingTimeoutId.current), []);

  // Dragging over (and out of) each child triggers these events on the element as well,
  // so debounce them.
  const setDragging = (isDragging: boolean) => {
    if (isDragging) {
      // When moving from child to child, dragenter is sent before the previous child's
      // dragleave.
      window.setTimeout(() => {
        window.clearTimeout(notDraggingTimeoutId.current);
        notDraggingTimeoutId.current = undefined;
        setIsDraggingOver(true);
      }, 0);
    } else {
      window.clearTimeout(notDraggingTimeoutId.current);
      notDraggingTimeoutId.current = window.setTimeout(() => setIsDraggingOver(false), 100);
    }
  };

  const handlers = {
    onDragEnter(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
      setDragging(true);
    },
    onDragOver(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
      setDragging(false);
    },
    onDrop(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(notDraggingTimeoutId.current);
      setIsDraggingOver(false);
      onDropFiles(event.dataTransfer.files);
    },
  };

  return { isDraggingOver, handlers };
}
