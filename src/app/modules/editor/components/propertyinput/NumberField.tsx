import { NO_AUTOFILL_PROPS } from 'app/modules/editor/components/common/noAutofill';
import { round } from 'lodash-es';
import { type KeyboardEvent, useState } from 'react';

// How far the arrow keys step a value, and with Shift held, like the property fields.
const STEP = 1;
const BIG_STEP = 10;

/**
 * A number field for values that aren't a model's properties, like a layer's bounds in the Layout
 * section and the points of a path being edited. It saves what's typed on Enter or blur, as one
 * change, and steps with the arrow keys. Escape goes back to the value.
 */
export function NumberField({
  label,
  ariaLabel,
  value,
  disabled = false,
  onCommit,
}: {
  /** A short label before the field, like X. */
  label?: string;
  /** What screen readers and the tests call it, which is the label if there's no other. */
  ariaLabel?: string;
  value: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  // What's being typed, until it's saved.
  const [text, setText] = useState<string | undefined>(undefined);
  const shown = String(round(value, 3));
  const commit = (entered: string | undefined) => {
    setText(undefined);
    const parsed = entered === undefined ? NaN : Number(entered);
    if (
      entered !== undefined &&
      entered.trim() &&
      Number.isFinite(parsed) &&
      round(parsed, 3) !== round(value, 3)
    ) {
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
    <label className="spi-field">
      {label && <span className="spi-field-label">{label}</span>}
      <input
        {...NO_AUTOFILL_PROPS}
        inputMode="decimal"
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        value={text ?? shown}
        onChange={event => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(text)}
      />
    </label>
  );
}
