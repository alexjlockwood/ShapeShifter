import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Icon } from 'app/modules/editor/components/icons/Icon';
import { useMenu } from 'app/modules/editor/hooks/useMenu';

/**
 * A button that shows the current option and opens a menu of the others, for the inspector's enum
 * properties and a point's type.
 */
export function MenuSelect<T extends string>({
  label,
  ariaLabel,
  options,
  onSelect,
}: {
  /** What the button shows: the current option's label, or e.g. "Mixed". */
  label: string;
  ariaLabel?: string;
  options: ReadonlyArray<{ readonly value: T; readonly label: string }>;
  onSelect: (value: T) => void;
}) {
  const menu = useMenu();
  return (
    <>
      <button
        type="button"
        className="spi-property-value-menu-target"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={menu.openMenu}
      >
        <span className="spi-property-value-menu-current-value">{label}</span>
        <Icon className="spi-property-value-menu-arrow" name="arrow_drop_down" />
      </button>
      <Menu anchorEl={menu.anchorEl} open={menu.open} onClose={menu.closeMenu}>
        {options.map(option => (
          <MenuItem
            key={option.value}
            onClick={() => {
              menu.closeMenu();
              onSelect(option.value);
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
