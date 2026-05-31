import * as ReactDOM from 'react-dom/client';
import { PrimeReactProvider } from '@primereact/core/config';
import Aura from '@primeuix/themes/aura';
import { themeController } from '@macro/macro-design/react';
import App from './app/app';
import './styles.css';

// Apply the macro theme (default 'macro') + dark/light class before first paint.
themeController.start();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <PrimeReactProvider theme={{ preset: Aura, options: { darkModeSelector: '.dark' } }}>
    <App />
  </PrimeReactProvider>
);
