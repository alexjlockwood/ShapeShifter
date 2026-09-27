import type { PathInspectorProps } from 'app/modules/editor/components/canvas/CanvasEditorApi';
import {
  getPointTypeLabel,
  POINT_TYPE_OPTIONS,
} from 'app/modules/editor/components/canvas/pointTypes';
import { Icon } from 'app/modules/editor/components/icons/Icon';
import { MenuSelect } from 'app/modules/editor/components/propertyinput/MenuSelect';
import { NumberField } from 'app/modules/editor/components/propertyinput/NumberField';
import type { Anchor, HandleSide, Path, PointType } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
import type { Point } from 'app/modules/editor/scripts/common';
import { round } from 'lodash-es';
import { type MouseEvent, useState } from 'react';

import { getPointMenuState } from './pointCommands';

/**
 * The property inspector's view of a path whose points are being edited: the selected point's
 * position, handles, and type, and each subpath, collapsed until it's opened, with its points and
 * buttons to reverse, open, and close it. It shows the path the canvas editor edits, which is a
 * path block's value at a keyframe, and saves there too, since its edits go through the editor
 * (CanvasEditorCommands.editPoints). Its styles are in components/propertyinput/propertyinput.scss,
 * since the editor's code can't import CSS.
 */
export function PathInspector({ layerId, state, onEdit, onSelect, onCommand }: PathInspectorProps) {
  const { path, selectedAnchorIds } = state;
  const anchors = PathEdit.getAnchors(path);
  const subPaths = path.getSubPaths();
  const selected = anchors.filter(a => selectedAnchorIds.has(a.id));
  // Which subpaths are open, by index, since subpaths don't have ids. They start collapsed.
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const edit = (fn: (base: Path) => Path) => onEdit(layerId, base => ({ path: fn(base) }));

  const onPointClick = (event: MouseEvent, anchor: Anchor) => {
    if (event.shiftKey) {
      const selection = new Set(selectedAnchorIds);
      if (!selection.delete(anchor.id)) {
        selection.add(anchor.id);
      }
      onSelect(selection);
    } else {
      onSelect(new Set([anchor.id]));
    }
  };

  return (
    <div className="spi-point-edit">
      {selected.length === 1 ? (
        <SelectedPoint
          // So that text typed for one point isn't saved to the next.
          key={selected[0].id}
          anchor={selected[0]}
          subPathCount={subPaths.length}
          setFirstReason={getPointMenuState(path, selectedAnchorIds)?.setFirstReason}
          onMove={point => edit(base => moveAnchorTo(base, selected[0].id, point))}
          onMoveHandle={(side, point) =>
            edit(base => PathEdit.moveHandle(base, selected[0].id, side, point, false))
          }
          onSetType={pointType => onCommand({ type: 'setPointType', pointType })}
          onSetFirst={() => onCommand({ type: 'setFirstPoint' })}
          onDelete={() => onCommand({ type: 'delete' })}
        />
      ) : selected.length > 1 ? (
        <section className="spi-section" aria-label={`${selected.length} points`}>
          <div className="spi-section-title">{selected.length} points</div>
          <div className="spi-row">
            <span className="spi-row-label">Type</span>
            <div className="spi-row-fields">
              <MenuSelect
                ariaLabel="Point type"
                label={getSharedTypeLabel(selected)}
                options={POINT_TYPE_OPTIONS}
                onSelect={pointType => onCommand({ type: 'setPointType', pointType })}
              />
            </div>
          </div>
          <div className="spi-row-actions">
            <button type="button" onClick={() => onCommand({ type: 'delete' })}>
              Delete
            </button>
          </div>
        </section>
      ) : (
        <div className="spi-point-edit-hint">
          Click a point on the canvas or in a subpath below to edit it
        </div>
      )}
      <section className="spi-section" aria-label="Subpaths">
        <div className="spi-section-title">Subpaths</div>
        {subPaths.map((_, subIdx) => {
          const points = anchors.filter(a => a.subIdx === subIdx);
          // Closed means it ends with a Z, which is what Open takes away, rather than that it
          // ends where it starts.
          const isClosed = PathEdit.isSubPathClosed(path, subIdx);
          const isExpanded = expanded.has(subIdx);
          const title = `Subpath ${subIdx + 1}`;
          return (
            // Subpaths don't have ids, and their order is what identifies them.
            <section className="spi-subpath" key={subIdx} aria-label={title}>
              <div className="spi-subpath-header">
                <button
                  type="button"
                  className="spi-subpath-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => {
                    const next = new Set(expanded);
                    if (!next.delete(subIdx)) {
                      next.add(subIdx);
                    }
                    setExpanded(next);
                  }}
                >
                  <Icon
                    name="chevron_right"
                    className={isExpanded ? 'spi-chevron is-expanded' : 'spi-chevron'}
                  />
                  <span className="spi-subpath-title">
                    {title} · {isClosed ? 'closed' : 'open'} · {points.length}{' '}
                    {points.length === 1 ? 'point' : 'points'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={points.length < 2}
                  onClick={() => edit(base => PathEdit.reverseSubPath(base, subIdx))}
                >
                  Reverse
                </button>
                {isClosed ? (
                  <button
                    type="button"
                    onClick={() => edit(base => PathEdit.openSubPath(base, subIdx))}
                  >
                    Open
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={points.length < 2}
                    onClick={() => edit(base => PathEdit.closeSubPath(base, subIdx))}
                  >
                    Close
                  </button>
                )}
              </div>
              {isExpanded && (
                <div className="spi-subpath-points">
                  {points.map(anchor => (
                    <button
                      type="button"
                      key={anchor.id}
                      className="spi-point-row"
                      aria-label={`Point ${anchor.index + 1}`}
                      aria-pressed={selectedAnchorIds.has(anchor.id)}
                      onClick={event => onPointClick(event, anchor)}
                    >
                      <span className="spi-point-number">{anchor.index + 1}</span>
                      <span>{formatPoint(anchor.point)}</span>
                      {anchor.in && <span>in {formatPoint(anchor.in)}</span>}
                      {anchor.out && <span>out {formatPoint(anchor.out)}</span>}
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </section>
    </div>
  );
}

function SelectedPoint({
  anchor,
  subPathCount,
  setFirstReason,
  onMove,
  onMoveHandle,
  onSetType,
  onSetFirst,
  onDelete,
}: {
  anchor: Anchor;
  subPathCount: number;
  setFirstReason: string | undefined;
  onMove: (point: Point) => void;
  onMoveHandle: (side: HandleSide, point: Point) => void;
  onSetType: (type: PointType) => void;
  onSetFirst: () => void;
  onDelete: () => void;
}) {
  const label = `Point ${anchor.index + 1}`;
  return (
    <section className="spi-section" aria-label={label}>
      <div className="spi-section-title">
        {subPathCount > 1 ? `${label} of subpath ${anchor.subIdx + 1}` : label}
      </div>
      <PointRow label="Position" point={anchor.point} onCommit={onMove} />
      {anchor.in && (
        <PointRow
          label="In handle"
          point={anchor.in}
          onCommit={point => onMoveHandle('in', point)}
        />
      )}
      {anchor.out && (
        <PointRow
          label="Out handle"
          point={anchor.out}
          onCommit={point => onMoveHandle('out', point)}
        />
      )}
      <div className="spi-row">
        <span className="spi-row-label">Type</span>
        <div className="spi-row-fields">
          <MenuSelect
            ariaLabel="Point type"
            label={getPointTypeLabel(anchor.type)}
            options={POINT_TYPE_OPTIONS}
            onSelect={onSetType}
          />
        </div>
      </div>
      <div className="spi-row-actions">
        <button
          type="button"
          disabled={setFirstReason !== undefined}
          title={setFirstReason}
          onClick={onSetFirst}
        >
          Set as first point
        </button>
        <button type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
      {setFirstReason && anchor.index > 0 && <div className="spi-row-note">{setFirstReason}</div>}
    </section>
  );
}

function PointRow({
  label,
  point,
  onCommit,
}: {
  label: string;
  point: Point;
  onCommit: (point: Point) => void;
}) {
  return (
    <div className="spi-row" role="group" aria-label={label}>
      <span className="spi-row-label">{label}</span>
      <div className="spi-row-fields">
        <NumberField label="X" value={point.x} onCommit={x => onCommit({ x, y: point.y })} />
        <NumberField label="Y" value={point.y} onCommit={y => onCommit({ x: point.x, y })} />
      </div>
    </div>
  );
}

/** Moves the anchor to the point, with its handles, in the path as it's saved. */
function moveAnchorTo(path: Path, anchorId: string, point: Point) {
  const anchor = PathEdit.getAnchors(path).find(a => a.id === anchorId);
  if (!anchor) {
    return path;
  }
  const delta = { x: point.x - anchor.point.x, y: point.y - anchor.point.y };
  return PathEdit.moveAnchors(path, new Set([anchorId]), delta);
}

function getSharedTypeLabel(anchors: ReadonlyArray<Anchor>) {
  const types = new Set(anchors.map(a => a.type));
  return types.size === 1 ? getPointTypeLabel(anchors[0].type) : 'Mixed';
}

function formatPoint({ x, y }: Point) {
  return `(${round(x, 3)}, ${round(y, 3)})`;
}
