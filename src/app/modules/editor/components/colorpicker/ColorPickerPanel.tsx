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
  // Undefined means a batch edit whose selected models disagree (see
  // buildPropertyInputModel.ts's getSharedValue); '' is a color property's own "no color".
  const isMixed = value === undefined;
  const rgba = androidColorToRgba(value);
  return (
    <div className="spi-color-picker">
      <RgbaColorPicker
        color={rgba}
        onChange={next => ip.previewValue(rgbaToAndroidColor(next))}
        onChangeEnd={() => ip.commitPreview()}
      />
      <div className="spi-color-picker-fields fx-row">
        <HexField ip={ip} isMixed={isMixed} />
        <AlphaField ip={ip} isMixed={isMixed} />
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
        aria-pressed={value === ''}
        onClick={() => {
          setColor(ip, '');
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
                  setColor(ip, color);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HexField({ ip, isMixed }: { ip: InspectedProperty<string>; isMixed: boolean }) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const displayValue = draft ?? (isMixed ? '' : androidColorToHex(ip.value));
  return (
    <input
      className="spi-color-picker-hex"
      name="colorPickerHex"
      aria-label="Hex"
      placeholder={isMixed && draft === undefined ? 'Mixed' : undefined}
      value={displayValue}
      onChange={event => {
        const next = event.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
        setDraft(next);
        if (isValidHex(next)) {
          setColor(
            ip,
            hexAndAlphaPercentToAndroidColor(next, androidColorToAlphaPercent(ip.value)),
          );
        }
      }}
      onBlur={() => setDraft(undefined)}
    />
  );
}

function AlphaField({ ip, isMixed }: { ip: InspectedProperty<string>; isMixed: boolean }) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const displayValue = draft ?? (isMixed ? '' : String(androidColorToAlphaPercent(ip.value)));
  return (
    <input
      className="spi-color-picker-alpha"
      name="colorPickerAlpha"
      aria-label="Alpha percentage"
      placeholder={isMixed && draft === undefined ? 'Mixed' : undefined}
      value={displayValue}
      onChange={event => {
        const next = event.target.value.replace(/[^0-9]/g, '').slice(0, 3);
        setDraft(next);
        if (isValidAlphaPercent(next)) {
          setColor(ip, hexAndAlphaPercentToAndroidColor(androidColorToHex(ip.value), Number(next)));
        }
      }}
      onBlur={() => setDraft(undefined)}
    />
  );
}

/**
 * Saves a color picked in the panel. It sets the value itself rather than editableValue: an entered
 * value would stay in the inspector's text field (which never had the focus, so never clears it)
 * after undo or a new selection, and ColorProperty's editable setter turns '' into undefined, which
 * a batch shows as Mixed.
 */
function setColor(ip: InspectedProperty<string>, value: string) {
  ip.resolveEnteredValue();
  ip.value = value;
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
    setColor(
      ip,
      hexAndAlphaPercentToAndroidColor(
        result.sRGBHex.replace(/^#/, ''),
        androidColorToAlphaPercent(ip.value),
      ),
    );
  } catch {
    // The user pressed Escape or clicked away, which rejects the promise instead of resolving it.
  }
}
