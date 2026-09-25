import Tooltip, { type TooltipProps } from '@mui/material/Tooltip';

/**
 * A tooltip that isn't shown for disabled controls, like Angular Material's tooltips.
 */
export function Tip({ disabled, children, ...props }: TooltipProps & { disabled?: boolean }) {
  return disabled ? children : <Tooltip {...props}>{children}</Tooltip>;
}
