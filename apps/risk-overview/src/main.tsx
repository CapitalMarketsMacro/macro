import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import '../../../libs/macro-design/src/lib/css/fonts.css';
import '../../../libs/macro-design/src/lib/css/macro-etrading.css';
import '../../../libs/macro-design/src/lib/css/macro-design.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
