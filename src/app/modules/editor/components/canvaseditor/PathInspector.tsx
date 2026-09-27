import type { PathInspectorProps } from 'app/modules/editor/components/canvas/CanvasEditorApi';
import type { Anchor } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
import { round } from 'lodash-es';
import { type KeyboardEvent, useState } from 'react';

// How far the arrow keys move a point in its field, and with Shift held, like the other fields.
const STEP = 1;
const BIG_STEP = 10;

/**
 * Lists a path's subpaths and their points, with fields for each point's x and y, and buttons to
 * reverse, close, and open subpaths. The path's text field is under "Advanced". Its styles are in
 * components/propertyinput/propertyinput.scss, since the editor's code can't import CSS.
 */
export function PathInspector({ path, onChange, advanced }: PathInspectorProps) {
  const anchors = path ? PathEdit.getAnchors(path) : [];
  const subPaths = path ? path.getSubPaths() : [];
  return (
    <div className="spi-path-inspector">
      {subPaths.map((_, subIdx) => {
        const points = anchors.filter(a => a.subIdx === subIdx);
        // Closed means it ends with a Z, which is what Open takes away, rather than that it ends
        // where it starts.
        const isClosed = !!path && PathEdit.isSubPathClosed(path, subIdx);
        return (
          // Subpaths don't have ids, and their order is what identifies them.
          <section className="spi-subpath" key={subIdx} aria-label={`Subpath ${subIdx + 1}`}>
            <div className="spi-subpath-header">
              <span className="spi-subpath-title">
                Subpath {subIdx + 1} · {isClosed ? 'closed' : 'open'}
              </span>
              <button
                type="button"
                disabled={!path || points.length < 2}
                onClick={() => path && onChange(PathEdit.reverseSubPath(path, subIdx))}
              >
                Reverse
              </button>
              {isClosed ? (
                <button
                  type="button"
                  disabled={!path}
                  onClick={() => path && onChange(PathEdit.openSubPath(path, subIdx))}
                >
                  Open
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!path || points.length < 2}
                  onClick={() => path && onChange(PathEdit.closeSubPath(path, subIdx))}
                >
                  Close
                </button>
              )}
            </div>
            {points.map(anchor => (
              <PointRow
                key={anchor.id}
                anchor={anchor}
                onMove={point =>
                  path &&
                  onChange(
                    PathEdit.moveAnchors(path, new Set([anchor.id]), {
                      x: point.x - anchor.point.x,
                      y: point.y - anchor.point.y,
                    }),
                  )
                }
              />
            ))}
          </section>
        );
      })}
      <details className="spi-path-advanced">
        <summary>Advanced</summary>
        {advanced}
      </details>
    </div>
  );
}

function PointRow({
  anchor,
  onMove,
}: {
  anchor: Anchor;
  onMove: (point: { x: number; y: number }) => void;
}) {
  const label = `Point ${anchor.index + 1}`;
  return (
    <div className="spi-point" role="group" aria-label={label}>
      <span className="spi-point-label">{anchor.index + 1}</span>
      <CoordinateField
        label="x"
        value={anchor.point.x}
        onCommit={x => onMove({ x, y: anchor.point.y })}
      />
      <CoordinateField
        label="y"
        value={anchor.point.y}
        onCommit={y => onMove({ x: anchor.point.x, y })}
      />
    </div>
  );
}

/** A number field that saves what's typed on Enter or blur, and steps with the arrow keys. */
function CoordinateField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  // What's being typed, until it's saved.
  const [text, setText] = useState<string | undefined>(undefined);
  const shown = String(round(value, 3));
  const commit = (entered: string | undefined) => {
    setText(undefined);
    const parsed = entered === undefined ? NaN : Number(entered);
    if (entered !== undefined && entered.trim() && Number.isFinite(parsed) && parsed !== value) {
      onCommit(round(parsed, 3));
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commit(text);
    } else if (event.key === 'Escape') {
      setText(undefined);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const step = (event.shiftKey ? BIG_STEP : STEP) * (event.key === 'ArrowUp' ? 1 : -1);
      setText(undefined);
      onCommit(round(value + step, 3));
    } else {
      return;
    }
    // So that the canvas and the timeline don't take the key too.
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <label className="spi-point-field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={text ?? shown}
        onChange={event => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(text)}
      />
    </label>
  );
}
