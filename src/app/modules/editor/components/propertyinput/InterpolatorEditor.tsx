import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { NO_AUTOFILL_PROPS } from 'app/modules/editor/components/common/noAutofill';
import { Icon } from 'app/modules/editor/components/icons/Icon';
import { useMenu } from 'app/modules/editor/hooks/useMenu';
import {
  CUSTOM_INTERPOLATOR_LABEL,
  type Curve,
  curveToString,
  INTERPOLATORS,
  parseCurve,
  resolveInterpolator,
} from 'app/modules/editor/model/interpolators';
import type { Point } from 'app/modules/editor/scripts/common';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  type CurveHandle,
  findNearestPoint,
  getAnchors,
  getCurveYRange,
  getHandlePoint,
  isInteriorAnchor,
  moveHandle,
  removeAnchor,
  splitSegment,
} from './curveEditing';
import type { InspectedProperty } from './InspectedProperty';
import './interpolatoreditor.scss';

// The graph's size in its viewBox's units, which are about a CSS pixel in the inspector.
const VIEW_WIDTH = 200;
const PADDING = 10;
const PLOT_WIDTH = VIEW_WIDTH - 2 * PADDING;
// The height of y's [0, 1], and the most the plot grows to when a curve overshoots.
const UNIT_HEIGHT = 120;
const MAX_PLOT_HEIGHT = 200;
const HANDLE_RADIUS = 4;
// How far (in CSS pixels) the pointer moves before a press on a handle becomes a drag.
const DRAG_THRESHOLD = 3;
// How close (in the viewBox's units) a double-click must be to the curve to add a point.
const ADD_POINT_DISTANCE = 12;

interface Layout {
  readonly minY: number;
  readonly maxY: number;
  readonly yScale: number;
  readonly height: number;
}

function getLayout(range: { readonly min: number; readonly max: number }): Layout {
  const yScale = Math.min(UNIT_HEIGHT, MAX_PLOT_HEIGHT / (range.max - range.min));
  return {
    minY: range.min,
    maxY: range.max,
    yScale,
    height: (range.max - range.min) * yScale + 2 * PADDING,
  };
}

function toView(layout: Layout, p: Point): Point {
  return { x: PADDING + p.x * PLOT_WIDTH, y: PADDING + (layout.maxY - p.y) * layout.yScale };
}

function fromView(layout: Layout, p: Point): Point {
  return { x: (p.x - PADDING) / PLOT_WIDTH, y: layout.maxY - (p.y - PADDING) / layout.yScale };
}

function clientToView(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return undefined;
  }
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function curveToViewPath(layout: Layout, curve: Curve) {
  if (!curve.length) {
    return '';
  }
  const f = (p: Point) => {
    const v = toView(layout, p);
    return `${v.x.toFixed(2)} ${v.y.toFixed(2)}`;
  };
  return `M ${f(curve[0].start)} ${curve.map(s => `C ${f(s.cp1)} ${f(s.cp2)} ${f(s.end)}`).join(' ')}`;
}

interface Drag {
  readonly pointerId: number;
  readonly handle: CurveHandle;
  // The curve when the drag started, which every move edits.
  readonly curve: Curve;
  // From the pointer to the handle, in the curve's units, so the handle doesn't jump.
  readonly offset: Point;
  readonly clientStart: Point;
  // The y range when the drag started. The graph only grows during a drag, so the handle stays
  // under the pointer.
  readonly range: { readonly min: number; readonly max: number };
  moved: boolean;
}

/**
 * Edits an animation block's interpolator: a menu of the presets plus "Custom", above a graph of
 * the easing curve with handles. The graph shows presets too, and editing one (dragging a handle,
 * or adding or removing a point) turns it into a custom curve, starting from the preset's shape.
 * Drags are previews saved as one undo step on release. Double-clicking the curve adds a point,
 * and double-clicking a point, or Delete with it selected, removes it. The curve's path data is
 * under the graph, where it can be typed or pasted too.
 */
export function InterpolatorEditor({
  ip,
  isMixed = false,
}: {
  ip: InspectedProperty<string>;
  /** Whether a batch edit's selected blocks disagree on the interpolator. */
  isMixed?: boolean;
}) {
  const menu = useMenu();
  const resolved = resolveInterpolator(ip.value);
  const curve = resolved.curve;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | undefined>(undefined);
  // The latest property, since each store change builds a new one.
  const ipRef = useRef(ip);
  // Picking "Custom" after a preset goes back to the last custom curve.
  const lastCustomRef = useRef<string | undefined>(undefined);
  const [selectedAnchor, setSelectedAnchor] = useState<number | undefined>(undefined);
  // Re-renders with the drag's range once a drag starts or ends.
  const [dragRange, setDragRange] = useState<Drag['range'] | undefined>(undefined);

  useEffect(() => {
    ipRef.current = ip;
    if (resolved.type === 'custom') {
      lastCustomRef.current = resolved.value;
    }
  });

  const curveRange = getCurveYRange(curve);
  const layout = getLayout(
    dragRange
      ? {
          min: Math.min(dragRange.min, curveRange.min),
          max: Math.max(dragRange.max, curveRange.max),
        }
      : curveRange,
  );
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  });

  const endDrag = (commit: boolean) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    dragRef.current = undefined;
    setDragRange(undefined);
    const svg = svgRef.current;
    if (svg?.hasPointerCapture(drag.pointerId)) {
      svg.releasePointerCapture(drag.pointerId);
    }
    if (drag.moved) {
      if (commit) {
        ipRef.current.commitPreview();
      } else {
        ipRef.current.cancelPreview();
      }
    }
  };
  const endDragRef = useRef(endDrag);
  useEffect(() => {
    endDragRef.current = endDrag;
  });

  useEffect(() => {
    // Keeps what a drag has shown so far when the window loses focus, or the editor goes away
    // (e.g. the block is deleted by another tab's undo), rather than leaving it unsaved.
    const onBlur = () => endDragRef.current(true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('blur', onBlur);
      endDragRef.current(true);
    };
  }, []);

  // Saves a value as its own undo step.
  const setValue = (value: string) => {
    const current = ipRef.current;
    current.resolveEnteredValue();
    current.value = value;
  };

  const setCurve = (next: Curve | undefined) => {
    if (next) {
      setValue(curveToString(next));
    }
  };

  // Only an interior anchor that still exists (e.g. not after an undo) can be selected.
  const selected =
    selectedAnchor !== undefined && isInteriorAnchor(curve, selectedAnchor)
      ? selectedAnchor
      : undefined;

  const onHandlePointerDown = (event: ReactPointerEvent, handle: CurveHandle) => {
    const svg = svgRef.current;
    if (event.button !== 0 || !svg || dragRef.current) {
      return;
    }
    // Not preventDefault, which could keep the double-click that removes an anchor from firing.
    // The graph's CSS keeps presses from selecting text or scrolling.
    event.stopPropagation();
    svg.focus({ preventScroll: true });
    setSelectedAnchor(handle.type === 'anchor' ? handle.index : undefined);
    const view = clientToView(svg, event.clientX, event.clientY);
    const handlePoint = getHandlePoint(curve, handle);
    if (!view || !handlePoint) {
      return;
    }
    const pointer = fromView(layout, view);
    svg.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      handle,
      curve,
      offset: { x: handlePoint.x - pointer.x, y: handlePoint.y - pointer.y },
      clientStart: { x: event.clientX, y: event.clientY },
      range: { min: layout.minY, max: layout.maxY },
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.clientStart.x, event.clientY - drag.clientStart.y) <
        DRAG_THRESHOLD
    ) {
      return;
    }
    const view = clientToView(event.currentTarget, event.clientX, event.clientY);
    if (!view) {
      return;
    }
    if (!drag.moved) {
      drag.moved = true;
      setDragRange(drag.range);
    }
    const pointer = fromView(layoutRef.current, view);
    const next = moveHandle(drag.curve, drag.handle, {
      x: pointer.x + drag.offset.x,
      y: pointer.y + drag.offset.y,
    });
    ipRef.current.previewValue(curveToString(next));
  };

  const onPointerUp = (event: ReactPointerEvent) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      endDrag(true);
    }
  };

  const onPointerCancel = (event: ReactPointerEvent) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      endDrag(false);
    }
  };

  const onDoubleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    const anchor = (event.target as Element).closest('[data-anchor]');
    if (anchor) {
      const index = Number(anchor.getAttribute('data-anchor'));
      setSelectedAnchor(undefined);
      setCurve(removeAnchor(curve, index));
      return;
    }
    if ((event.target as Element).closest('[data-control]')) {
      return;
    }
    const view = clientToView(event.currentTarget, event.clientX, event.clientY);
    if (!view) {
      return;
    }
    const nearest = findNearestPoint(curve, fromView(layout, view), p => toView(layout, p));
    if (!nearest || nearest.distance > ADD_POINT_DISTANCE) {
      return;
    }
    const next = splitSegment(curve, nearest.segment, nearest.t);
    if (next) {
      setSelectedAnchor(nearest.segment + 1);
      setCurve(next);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      // Otherwise the shortcut service deletes the selected block.
      event.stopPropagation();
      event.preventDefault();
      if (selected !== undefined && !dragRef.current) {
        setSelectedAnchor(undefined);
        setCurve(removeAnchor(curve, selected));
      }
    } else if (event.key === 'Escape' && dragRef.current) {
      event.stopPropagation();
      endDrag(false);
    }
  };

  const onPresetClick = (value: string) => {
    menu.closeMenu();
    setSelectedAnchor(undefined);
    setValue(value);
  };

  const onCustomClick = () => {
    menu.closeMenu();
    if (resolved.type === 'custom') {
      return;
    }
    setValue(lastCustomRef.current ?? curveToString(curve));
  };

  const anchors = getAnchors(curve);
  const unitTop = toView(layout, { x: 0, y: 1 });
  const unitBottom = toView(layout, { x: 1, y: 0 });
  const path = curveToViewPath(layout, curve);
  return (
    <div className="spi-interpolator-editor fx-column">
      <button
        className="spi-property-value-menu-target"
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={menu.openMenu}
      >
        <span className="spi-property-value-menu-current-value">
          {isMixed ? 'Mixed' : ip.getDisplayValue()}
        </span>
        <Icon className="spi-property-value-menu-arrow" name="arrow_drop_down" />
      </button>
      <Menu anchorEl={menu.anchorEl} open={menu.open} onClose={menu.closeMenu}>
        {INTERPOLATORS.map(option => (
          <MenuItem
            key={option.value}
            selected={!isMixed && resolved.type === 'preset' && resolved.preset === option}
            onClick={() => onPresetClick(option.value)}
          >
            {option.label}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem selected={!isMixed && resolved.type === 'custom'} onClick={onCustomClick}>
          {CUSTOM_INTERPOLATOR_LABEL}
        </MenuItem>
      </Menu>
      <svg
        ref={svgRef}
        className="spi-curve-graph"
        viewBox={`0 0 ${VIEW_WIDTH} ${layout.height}`}
        tabIndex={0}
        role="group"
        aria-label="Easing curve. Drag the handles to edit it, double-click the curve to add a point, and double-click a point to remove it."
        onPointerDown={event => {
          if (event.button === 0) {
            setSelectedAnchor(undefined);
          }
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        // Chrome takes the capture away before a move with the button already up (see
        // components/AGENTS.md), so losing it ends the drag like its release.
        onLostPointerCapture={onPointerUp}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        onBlur={() => endDrag(true)}
      >
        <rect
          className="spi-curve-frame"
          x={unitTop.x}
          y={unitTop.y}
          width={unitBottom.x - unitTop.x}
          height={unitBottom.y - unitTop.y}
        />
        <path className="spi-curve-path" d={path} />
        {curve.map((s, i) => {
          const start = toView(layout, s.start);
          const cp1 = toView(layout, s.cp1);
          const cp2 = toView(layout, s.cp2);
          const end = toView(layout, s.end);
          return (
            <g key={i}>
              <line
                className="spi-curve-handle-line"
                x1={start.x}
                y1={start.y}
                x2={cp1.x}
                y2={cp1.y}
              />
              <line className="spi-curve-handle-line" x1={end.x} y1={end.y} x2={cp2.x} y2={cp2.y} />
            </g>
          );
        })}
        {anchors.map((a, i) => {
          const p = toView(layout, a);
          if (!isInteriorAnchor(curve, i)) {
            return <circle key={i} className="spi-curve-end" cx={p.x} cy={p.y} r={3} />;
          }
          const size = HANDLE_RADIUS * 2;
          return (
            <rect
              key={i}
              className={i === selected ? 'spi-curve-anchor is-selected' : 'spi-curve-anchor'}
              data-anchor={i}
              x={p.x - size / 2}
              y={p.y - size / 2}
              width={size}
              height={size}
              onPointerDown={event => onHandlePointerDown(event, { type: 'anchor', index: i })}
            />
          );
        })}
        {curve.flatMap((s, i) =>
          (['cp1', 'cp2'] as const).map(which => {
            const p = toView(layout, s[which]);
            return (
              <circle
                key={`${i}-${which}`}
                className="spi-curve-control"
                data-control={`${i}-${which}`}
                cx={p.x}
                cy={p.y}
                r={HANDLE_RADIUS}
                onPointerDown={event =>
                  onHandlePointerDown(event, { type: 'control', segment: i, which })
                }
              />
            );
          }),
        )}
      </svg>
      <CurvePathDataField
        value={isMixed ? undefined : curveToString(curve)}
        onCommit={next => {
          setSelectedAnchor(undefined);
          setCurve(next);
        }}
      />
    </div>
  );
}

/**
 * The curve as Android pathInterpolator path data, which presets show too. Typing a valid curve
 * (see parseCurve) saves it on Enter or blur, as a custom curve, and Escape goes back. value is
 * undefined for a batch edit whose blocks disagree.
 */
function CurvePathDataField({
  value,
  onCommit,
}: {
  value: string | undefined;
  onCommit: (curve: Curve) => void;
}) {
  // What's being typed, until it's saved.
  const [text, setText] = useState<string | undefined>(undefined);
  const commit = () => {
    if (text === undefined) {
      return;
    }
    setText(undefined);
    const next = parseCurve(text);
    if (next && curveToString(next) !== value) {
      onCommit(next);
    }
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commit();
    } else if (event.key === 'Escape') {
      setText(undefined);
    } else {
      return;
    }
    // So that the canvas and the timeline don't take the key too.
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <input
      {...NO_AUTOFILL_PROPS}
      className={
        text !== undefined && !parseCurve(text)
          ? 'spi-curve-path-data has-input-error'
          : 'spi-curve-path-data'
      }
      aria-label="Easing curve path data"
      spellCheck={false}
      placeholder={value === undefined && text === undefined ? 'Mixed' : undefined}
      value={text ?? value ?? ''}
      onChange={event => setText(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
    />
  );
}
