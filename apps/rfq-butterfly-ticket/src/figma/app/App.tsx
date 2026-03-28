import { useState } from 'react';
import { ButterflyTicket } from './components/ButterflyTicket';
import { themes, ThemeMode, ThemeName, themeDisplayNames } from './themes';
import { Moon, Sun, Palette } from 'lucide-react';

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [themeName, setThemeName] = useState<ThemeName>('neoQuantum');
  const currentTheme = themes[themeName][themeMode];

  const toggleThemeMode = () => {
    setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  };

  return (
    <div 
      className="min-h-screen p-8 transition-colors duration-300"
      style={{ backgroundColor: currentTheme.background1 }}
    >
      <div className="max-w-[1000px] mx-auto">
        <div className="flex justify-end items-center gap-3 mb-4">
          {/* Theme Selector */}
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" style={{ color: currentTheme.textDefault }} />
            <select
              value={themeName}
              onChange={(e) => setThemeName(e.target.value as ThemeName)}
              className="px-3 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: currentTheme.brandSecondary,
                color: currentTheme.brandSecondaryText,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: currentTheme.borderNeutral,
              }}
            >
              {(Object.keys(themes) as ThemeName[]).map((name) => (
                <option key={name} value={name}>
                  {themeDisplayNames[name]}
                </option>
              ))}
            </select>
          </div>

          {/* Light/Dark Toggle */}
          <button
            onClick={toggleThemeMode}
            className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all duration-200"
            style={{
              backgroundColor: currentTheme.brandSecondary,
              color: currentTheme.brandSecondaryText,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = currentTheme.brandSecondaryHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = currentTheme.brandSecondary;
            }}
          >
            {themeMode === 'dark' ? (
              <>
                <Sun className="w-4 h-4" />
                Light
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" />
                Dark
              </>
            )}
          </button>
        </div>
        <ButterflyTicket theme={currentTheme} />
      </div>
    </div>
  );
}
