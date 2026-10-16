import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { MISSED_GRACE_DAYS } from '@/engine';
import { formatCount } from '@/lib/format';

import '~/site/fonts.css';
import '~/site/tokens.css';

function Placeholder() {
  return (
    <main>
      <h1>Win Zero</h1>
      <p>
        The browser version is on its way. {formatCount(MISSED_GRACE_DAYS)} missed days in a row cost nothing.
      </p>
    </main>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Placeholder />
    </StrictMode>,
  );
}
