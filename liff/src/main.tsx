import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.js';
import { SessionProvider } from './state/session.js';
import { ThemeProvider } from './state/theme.js';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('#root element not found in index.html');
}

createRoot(root).render(
  <StrictMode>
    <SessionProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </SessionProvider>
  </StrictMode>
);
