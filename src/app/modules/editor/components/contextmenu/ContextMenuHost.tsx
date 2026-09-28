import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import { Icon } from 'app/modules/editor/components/icons/Icon';
import { useEditorStore, useServices } from 'app/modules/editor/context/EditorContext';
import { ShortcutService } from 'app/modules/editor/services/shortcut.service';
import { getSelectedLayerIds } from 'app/modules/editor/store/layers/selectors';
import { getCurrentTime } from 'app/modules/editor/store/playback/selectors';
import { getSelectedBlockIds } from 'app/modules/editor/store/timeline/selectors';
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  buildContextMenu,
  type ContextMenuItem,
  type ContextMenuSection,
  formatShortcut,
} from './buildContextMenu';
import type { ContextMenuRequest } from './contextmenu.service';
import './contextmenu.scss';

/**
 * Shows the context menu that the ContextMenuService asks for, with the items buildContextMenu
 * returns for the selection when it opens.
 */
export function ContextMenuHost() {
  const services = useServices();
  const store = useEditorStore();
  const { contextMenuService, layerTimelineService, canvasEditorBridgeService } = services;
  const request = useSyncExternalStore(contextMenuService.subscribe, contextMenuService.getRequest);

  // Keep showing the last menu while it animates closed. Its items are built once, from the state
  // when it opens.
  const [shown, setShown] = useState<{
    readonly request: ContextMenuRequest;
    readonly sections: ReadonlyArray<ContextMenuSection>;
  }>();
  if (request && request !== shown?.request) {
    const state = store.getState();
    const sections = buildContextMenu(
      {
        document: layerTimelineService.getDocument(),
        selectedLayerIds: getSelectedLayerIds(state),
        target: request.target,
        blockIds: request.blockIds ?? Array.from(getSelectedBlockIds(state)),
        currentTime: getCurrentTime(state),
        editor: canvasEditorBridgeService.getMenuState(),
        isZoomedToFit: services.canvasViewportService.getView().type === 'fit',
      },
      services,
    );
    setShown({ request, sections });
  }
  if (!shown) {
    return undefined;
  }
  return (
    <ContextMenu
      key={shown.request.key}
      open={request === shown.request}
      position={shown.request.position}
      sections={shown.sections}
      onClose={() => contextMenuService.close()}
      onExited={() => setShown(undefined)}
    />
  );
}

interface OpenSubmenu {
  readonly item: ContextMenuItem;
  readonly anchor: HTMLElement;
  // A submenu opened with the keyboard takes the focus, and one opened by hovering doesn't.
  readonly byKeyboard: boolean;
}

interface ContextMenuProps {
  readonly open: boolean;
  readonly position: { readonly x: number; readonly y: number };
  readonly sections: ReadonlyArray<ContextMenuSection>;
  readonly onClose: () => void;
  readonly onExited: () => void;
}

/**
 * An MUI menu at a point, with submenus, which MUI doesn't have. A submenu opens when its item is
 * hovered, clicked, or focused and ArrowRight, Enter, or Space is pressed. ArrowLeft and Escape
 * close it and go back to its item. It isn't modal, so the pointer can go back to the main menu's
 * items, and a click outside of both goes to the main menu's backdrop, which closes it.
 */
function ContextMenu({ open, position, sections, onClose, onExited }: ContextMenuProps) {
  const [submenu, setSubmenu] = useState<OpenSubmenu>();
  // The menu's modal, which the submenus go in.
  const [modal, setModal] = useState<HTMLDivElement | null>(null);
  const isMac = ShortcutService.isMac();

  const run = (item: ContextMenuItem) => {
    setSubmenu(undefined);
    onClose();
    item.run?.();
  };

  const closeSubmenu = () => {
    submenu?.anchor.focus();
    setSubmenu(undefined);
  };

  const renderItem = (item: ContextMenuItem, parent?: ContextMenuItem): ReactNode => {
    const isDisabled = item.disabledReason !== undefined;
    const hasSubmenu = !!item.submenu && !isDisabled;
    const isSubmenuOpen = submenu?.item === item;
    const openSubmenu = (anchor: HTMLElement, byKeyboard: boolean) => {
      if (!isSubmenuOpen || byKeyboard !== submenu.byKeyboard) {
        setSubmenu({ item, anchor, byKeyboard });
      }
    };
    return (
      <MenuItem
        key={item.id}
        dense
        disabled={isDisabled}
        className={isSubmenuOpen ? 'is-submenu-open' : undefined}
        aria-haspopup={hasSubmenu ? 'menu' : undefined}
        aria-expanded={hasSubmenu ? isSubmenuOpen : undefined}
        onMouseEnter={(event: MouseEvent<HTMLElement>) => {
          if (parent) {
            return;
          }
          if (hasSubmenu) {
            openSubmenu(event.currentTarget, false);
          } else if (submenu) {
            // Hovering another item of the main menu closes the submenu.
            setSubmenu(undefined);
          }
        }}
        onFocus={() => {
          if (!parent && submenu && !isSubmenuOpen) {
            setSubmenu(undefined);
          }
        }}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          if (hasSubmenu && event.key === 'ArrowRight') {
            event.preventDefault();
            openSubmenu(event.currentTarget, true);
          }
        }}
        onClick={(event: MouseEvent<HTMLElement>) => {
          if (hasSubmenu) {
            // Enter and Space click too, with no mouse button, and open it for the keyboard.
            openSubmenu(event.currentTarget, event.detail === 0);
          } else {
            run(item);
          }
        }}
      >
        <span className="app-contextmenu-label">
          <span>{item.label}</span>
          {item.disabledReason && (
            <span className="app-contextmenu-reason">{item.disabledReason}</span>
          )}
        </span>
        {item.shortcut && (
          <span className="app-contextmenu-shortcut">{formatShortcut(item.shortcut, isMac)}</span>
        )}
        {item.submenu && <Icon className="app-contextmenu-arrow" name="chevron_right" />}
      </MenuItem>
    );
  };

  const renderSections = (items: ReadonlyArray<ContextMenuSection>, parent?: ContextMenuItem) =>
    items.flatMap((section, i) => [
      ...(i > 0 ? [<Divider key={`divider-${i}`} />] : []),
      ...section.map(item => renderItem(item, parent)),
    ]);

  // The browser's menu would open over the menu's backdrop.
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    onClose();
  };

  return (
    <>
      <Menu
        ref={setModal}
        className="app-contextmenu"
        open={open}
        onClose={onClose}
        anchorReference="anchorPosition"
        anchorPosition={{ top: position.y, left: position.x }}
        variant="menu"
        // The list takes the focus, and ArrowDown goes to the first item, like the browser's menus.
        disableAutoFocusItem
        // The submenus take the focus from it.
        disableEnforceFocus
        slotProps={{
          root: { onContextMenu },
          transition: { onExited },
          list: {
            className: 'app-contextmenu-list',
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key === 'Escape' && submenu) {
                // A submenu that opened on hover closes first.
                event.stopPropagation();
                setSubmenu(undefined);
              }
            },
          },
        }}
      >
        {renderSections(sections)}
      </Menu>
      {submenu?.item.submenu && (
        <Popper
          className="app-contextmenu-submenu"
          open={open}
          anchorEl={submenu.anchor}
          placement="right-start"
          // In the menu's modal, so the keyboard shortcuts leave its keys alone, as they do the
          // menu's. It's next to the menu in React, so its events don't reach the menu's items.
          container={modal}
          onContextMenu={onContextMenu}
        >
          <Paper elevation={8}>
            <MenuList
              className="app-contextmenu-list"
              autoFocusItem={submenu.byKeyboard}
              variant="menu"
              onKeyDown={(event: KeyboardEvent) => {
                if (event.key === 'ArrowLeft' || event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  closeSubmenu();
                } else if (event.key === 'Tab') {
                  event.preventDefault();
                  onClose();
                }
              }}
            >
              {renderSections([submenu.item.submenu], submenu.item)}
            </MenuList>
          </Paper>
        </Popper>
      )}
    </>
  );
}
