import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Moon, Sun, Triangle } from 'lucide-react';
import { useTheme } from '@macro/macro-design/react';
import { Button } from '@/components/ui/button';
import { DataSourceProvider } from './data-source-context';
import { SourceCatalog } from './components/source-catalog';
import { Blotter } from './components/blotter';

export function App() {
  return (
    <BrowserRouter basename="/prism-react">
      <DataSourceProvider>
        <Shell />
      </DataSourceProvider>
    </BrowserRouter>
  );
}

function Shell() {
  const { isDark, toggle } = useTheme();
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-4 border-b px-4 py-2">
        <NavLink to="/blotter" className="flex items-baseline gap-2 no-underline text-foreground">
          <Triangle className="size-5 text-primary" />
          <span className="text-lg font-bold">Prism</span>
          <span className="text-xs opacity-60">Blotter as a Service · React</span>
        </NavLink>
        <nav className="ml-2 flex items-center gap-1">
          <NavLink
            to="/blotter"
            className={({ isActive }) =>
              `text-sm px-2 py-1 rounded ${isActive ? 'bg-accent text-accent-foreground' : 'opacity-80'}`
            }
          >
            Blotter
          </NavLink>
          <NavLink
            to="/sources"
            className={({ isActive }) =>
              `text-sm px-2 py-1 rounded ${isActive ? 'bg-accent text-accent-foreground' : 'opacity-80'}`
            }
          >
            Catalog
          </NavLink>
        </nav>
        <div className="ml-auto">
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-4 overflow-auto flex flex-col">
        <Routes>
          <Route path="/blotter" element={<Blotter />} />
          <Route path="/sources" element={<SourceCatalog />} />
          <Route path="*" element={<Navigate to="/blotter" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
