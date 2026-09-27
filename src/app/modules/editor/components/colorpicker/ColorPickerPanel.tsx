import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Icon } from 'app/modules/editor/components/icons/Icon';
import { ColorUtil } from 'app/modules/editor/scripts/common';
import { useState } from 'react';
import { RgbaColorPicker } from 'react-colorful';

import {
  androidColorToAlphaPercent,
  androidColorToHex,
  androidColorToRgba,
  hexAndAlphaPercentToAndroidColor,
  isValidAlphaPercent,
  isValidHex,
  rgbaToAndroidColor,
} from './colorConversions';
import type { InspectedProperty } from '../propertyinput/InspectedProperty';

// The EyeDropper API isn't in TypeScript's DOM lib yet. It's supported in Chrome and Edge, and
// unsupported in Firefox and Safari, so the button that uses it is hidden without it.
declare global {
  interface Window {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
  }
}

/**
 * The color picker's panel: a saturation square, a hue slider, and an alpha slider (react-colorful's
 * RgbaColorPicker), a Hex field and an alpha % field, an eyedropper, a "No color" option, and swatches
 * for every color already used in the document.
 *
 * Dragging the square or the sliders previews the color and commits it once, on release (see
 * InspectedProperty.previewValue). Typing in the Hex or alpha field, picking a swatch, or choosing
 * "No color" sets the value directly instead, as its own undo step.
 */
export function ColorPickerPanel({
  ip,
  documentColors,
}: {
  ip: InspectedProperty<string>;
  documentColors: readonly string[];
}) {
  const value = ip.value;
  const rgba = androidColorToRgba(value);
  return (
    <div className="spi-color-picker">
      <RgbaColorPicker
        color={rgba}
        onChange={next => ip.previewValue(rgbaToAndroidColor(next))}
        onChangeEnd={() => ip.commitPreview()}
      />
      <div className="spi-color-picker-fields fx-row">
        <HexField ip={ip} />
        <AlphaField ip={ip} />
        {isEyeDropperSupported() && (
          <Tooltip title="Pick color from screen">
            <IconButton
              className="spi-color-picker-eyedropper"
              aria-label="Pick color from screen"
              onClick={() => pickWithEyeDropper(ip)}
            >
              <Icon name="colorize" />
            </IconButton>
          </Tooltip>
        )}
      </div>
      <button
        type="button"
        className="spi-color-picker-none"
        aria-pressed={!value}
        onClick={() => {
          // ip is an InspectedProperty, not a plain data prop: its editableValue setter is how a
          // click or a keystroke is meant to change it (see InspectedProperty.ts).
          // oxlint-disable-next-line react/immutability
          ip.editableValue = '';
        }}
      >
        <span className="spi-color-swatch spi-color-swatch-empty" aria-hidden>
          <Icon name="block" />
        </span>
        No color
      </button>
      {documentColors.length > 0 && (
        <div className="spi-color-picker-swatches">
          <div className="spi-color-picker-swatches-label">In this document</div>
          <div className="spi-color-picker-swatches-grid">
            {documentColors.map(color => (
              <button
                key={color}
                type="button"
                className="spi-color-swatch"
                aria-label={`Use color ${color}`}
                aria-pressed={color === value}
                style={{ backgroundColor: ColorUtil.androidToCssRgbaColor(color) }}
                onClick={() => {
                  ip.editableValue = color;
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HexField({ ip }: { ip: InspectedProperty<string> }) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const displayValue = draft ?? androidColorToHex(ip.value);
  return (
    <input
      className="spi-color-picker-hex"
      name="colorPickerHex"
      aria-label="Hex"
      value={displayValue}
      onChange={event => {
        const next = event.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
        setDraft(next);
        if (isValidHex(next)) {
          // See the comment on the "No color" button's click handler above.
          // oxlint-disable-next-line react/immutability
          ip.editableValue = hexAndAlphaPercentToAndroidColor(
            next,
            androidColorToAlphaPercent(ip.value),
          );
        }
      }}
      onBlur={() => setDraft(undefined)}
    />
  );
}

function AlphaField({ ip }: { ip: InspectedProperty<string> }) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const displayValue = draft ?? String(androidColorToAlphaPercent(ip.value));
  return (
    <input
      className="spi-color-picker-alpha"
      name="colorPickerAlpha"
      aria-label="Alpha percentage"
      value={displayValue}
      onChange={event => {
        const next = event.target.value.replace(/[^0-9]/g, '').slice(0, 3);
        setDraft(next);
        if (isValidAlphaPercent(next)) {
          // See the comment on the "No color" button's click handler above.
          // oxlint-disable-next-line react/immutability
          ip.editableValue = hexAndAlphaPercentToAndroidColor(
            androidColorToHex(ip.value),
            Number(next),
          );
        }
      }}
      onBlur={() => setDraft(undefined)}
    />
  );
}

function isEyeDropperSupported() {
  return typeof window !== 'undefined' && !!window.EyeDropper;
}

async function pickWithEyeDropper(ip: InspectedProperty<string>) {
  if (!window.EyeDropper) {
    return;
  }
  try {
    const result = await new window.EyeDropper().open();
    // The eyedropper only returns an opaque RGB color, so keep the color's existing alpha.
    ip.editableValue = hexAndAlphaPercentToAndroidColor(
      result.sRGBHex.replace(/^#/, ''),
      androidColorToAlphaPercent(ip.value),
    );
  } catch {
    // The user pressed Escape or clicked away, which rejects the promise instead of resolving it.
  }
}
