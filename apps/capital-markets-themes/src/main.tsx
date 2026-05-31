import * as ReactDOM from 'react-dom/client';
import { themeController } from '@macro/macro-design/react';
import App from './app/app';
import '../../../libs/macro-design/src/lib/css/fonts.css';
import '../../../libs/macro-design/src/lib/css/macro-etrading.css';
import '../../../libs/macro-design/src/lib/css/macro-design.css';
import './figma/styles/index.css';

// Apply the macro theme (default 'macro') + dark/light class before first paint.
themeController.start();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
