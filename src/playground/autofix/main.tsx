import './playground.css';

import { createRoot } from 'react-dom/client';

import { Playground } from './Playground';

const root = document.getElementById('root');
if (!root) {
  throw new Error('The playground page needs a #root element');
}
createRoot(root).render(<Playground />);
