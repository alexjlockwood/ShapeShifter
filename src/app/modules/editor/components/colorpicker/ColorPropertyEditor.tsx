import Popover from '@mui/material/Popover';
import { Icon } from 'app/modules/editor/components/icons/Icon';
import { useMenu } from 'app/modules/editor/hooks/useMenu';
import { ColorUtil } from 'app/modules/editor/scripts/common';
import { useEffect, useRef } from 'react';

import { ColorPickerPanel } from './ColorPickerPanel';
import type { InspectedProperty } from '../propertyinput/InspectedProperty';

/**
 * The swatch button and popover for a color property, used for a layer's fill and stroke colors,
 * the vector layer's canvas color, and a color block's from and to values (anything with a
 * ColorProperty). ip is the inspected property to show and edit; documentColors are the "In this
 * document" swatches (see documentColors.ts), computed once for every color property in the panel.
 * alphaMultiplier combines with the color's own alpha for the swatch, matching what the canvas
 * draws (see getColorAlphaMultiplier in buildPropertyInputModel.ts); it defaults to 1 for a color
 * with no separate alpha of its own. isMixed shows a striped swatch instead, for a batch edit whose
 * selected models disagree on the color; picking or typing one in the popover applies it to all of
 * them (see buildPropertyInputModel.ts's buildBatchProperties).
 */
export function ColorPropertyEditor({
  ip,
  documentColors,
  alphaMultiplier = 1,
  isMixed = false,
}: {
  ip: InspectedProperty<string>;
  documentColors: readonly string[];
  alphaMultiplier?: number;
  isMixed?: boolean;
}) {
  const menu = useMenu();

  // A drag's preview (see InspectedProperty.previewValue) must commit or cancel when the popover
  // closes, when this editor unmounts (e.g. the selection changes), and on a window blur that
  // happens mid-drag, or the previewed color stays on screen and the next edit's undo step saves
  // it (see store/AGENTS.md, "Pending previews"). react-colorful itself commits on every pointer
  // and key release, so this only catches the drag that a blur interrupts before that fires.
  const ipRef = useRef(ip);
  useEffect(() => {
    ipRef.current = ip;
  });
  useEffect(() => {
    if (!menu.open) {
      return;
    }
    const onBlur = () => ipRef.current.commitPreview();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [menu.open]);
  useEffect(() => () => ipRef.current.commitPreview(), []);

  const value = ip.value;
  return (
    <>
      <button
        type="button"
        className={
          isMixed
            ? 'spi-property-color-preview spi-color-swatch is-mixed'
            : 'spi-property-color-preview spi-color-swatch'
        }
        style={
          isMixed
            ? undefined
            : { backgroundColor: ColorUtil.androidToCssRgbaColor(value, alphaMultiplier) }
        }
        aria-label={isMixed ? 'Edit color (Mixed)' : 'Edit color'}
        onClick={menu.openMenu}
      >
        {!isMixed && !value && <Icon name="block" className="spi-color-swatch-empty-icon" />}
      </button>
      <Popover
        open={menu.open}
        anchorEl={menu.anchorEl}
        onClose={() => {
          ip.commitPreview();
          menu.closeMenu();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { className: 'spi-color-picker-popover' } }}
        // No grow animation, so a drag that starts right after opening lands on the final
        // position instead of the transition's mid-scale one.
        transitionDuration={0}
      >
        <ColorPickerPanel ip={ip} documentColors={documentColors} />
      </Popover>
    </>
  );
}
