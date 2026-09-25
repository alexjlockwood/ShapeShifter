import { type MouseEvent, useState } from 'react';

/** Tracks the element that anchors an MUI menu while it's open. */
export function useMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return {
    anchorEl,
    open: !!anchorEl,
    openMenu: (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget),
    closeMenu: () => setAnchorEl(null),
  };
}
