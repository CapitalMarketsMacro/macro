import { BrowserRouter } from 'react-router-dom';
import { useTheme } from '@macro/macro-design/react';
import FigmaApp from '../figma/app/App';

export function App() {
  // Activate the macro theme controller (default 'macro' + dark/light + system/OpenFin sync).
  useTheme();

  return (
    <BrowserRouter basename="/capital-markets-themes/">
      <FigmaApp />
    </BrowserRouter>
  );
}

export default App;
