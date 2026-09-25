import type { State } from 'app/modules/editor/store';
import { useSelector } from 'react-redux';

/** Re-renders the component whenever the selected value changes. */
export const useAppSelector = useSelector.withTypes<State>();
