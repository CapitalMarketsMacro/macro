import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';
import FigmaApp from '../figma/app/App';


export function App() {
  const [isDark, setIsDark] = useState(getInitialIsDark);
  useEffect(() => { applyDarkMode(isDark); }, [isDark]);
  useEffect(() => onSystemThemeChange((d) => setIsDark(d)), []);

  return (
    <BrowserRouter basename="/rfq-butterfly-ticket/">
      <FigmaApp />
    </BrowserRouter>
  );
}

export default App;
