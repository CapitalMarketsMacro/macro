# Macro Desktop MFE

A comprehensive monorepo for building financial market data applications using Angular, React, and OpenFin. This workspace provides real-time market data visualization, trading dashboards, and workspace integration capabilities.

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

## 🏗️ Architecture

This is an [Nx monorepo](https://nx.dev) workspace containing multiple applications and shared libraries:

- **Applications**: Standalone Angular and React applications for different market data views
- **Libraries**: Reusable components and utilities shared across applications
- **Workspace**: OpenFin workspace platform integration

## 📦 Applications

### 1. **macro-angular** - Angular Market Data Application

A standalone Angular application featuring:

- **FX Market Data Component**: Real-time foreign exchange market data with G10 currency pairs
  - Live bid/ask prices and spreads
  - Price change indicators
  - Real-time updates via ag-Grid
  - Custom price formatting

- **Treasury Microstructure Component**: US Treasury E-Trading Market Microstructure analysis
  - Trade frequency/count per interval (bar chart)
  - Order-to-trade ratios (line chart)
  - Quote update frequency (line chart)
  - Time between trades (line chart)
  - Real-time data updates with ag-Charts
  - Responsive 2x2 grid layout

**Features:**
- Angular Router for navigation
- PrimeNG MenuBar for top navigation
- Light/Dark theme toggle with system preference detection
- Theme persistence via localStorage
- ag-Grid with automatic theme switching
- ag-Charts with theme-aware styling

**Run:**
```bash
npx nx serve macro-angular
```

**Build:**
```bash
npx nx build macro-angular
```

### 2. **macro-react** - React Market Data Application

A standalone React application featuring:

- **Treasury Market Data Component**: US Treasury securities market data
  - Treasury 32nd price formatting (similar to Angular pipes)
  - T-Bills, T-Notes, and T-Bonds
  - Real-time price updates
  - Yield, duration, and convexity calculations
  - ag-Grid with theme support

- **Commodities Trading Dashboard**: Professional commodities trading interface
  - **Commodities**: Energy (Crude Oil, Natural Gas), Metals (Gold, Silver, Copper), Agriculture (Corn, SoyBeans)
  - Live streaming with pause/play controls (Shadcn Switch)
  - Speed adjustment (0.5x to 4x)
  - Color-coded spreads (positive = green, negative = red)
  - Enhanced order book with visual styling
  - Market summary panel with key metrics
  - Custom tooltips with dark theme support
  - 5 live statistics updating constantly
  - Category-based commodity selection
  - Live indicator with pulsing animation
  - Realistic market behavior (contango/backwardation)
  - Professional trading desk styling
  - Responsive grid layout

**Features:**
- React Router for navigation
- Shadcn UI Menubar for navigation
- Shadcn UI Switch for controls
- Light/Dark theme toggle with blue theme
- Theme persistence via localStorage
- ag-Grid with automatic theme switching
- Recharts for data visualization
- Tailwind CSS for styling

**Run:**
```bash
npx nx serve macro-react
```

**Build:**
```bash
npx nx build macro-react
```

### 3. **macro-workspace** - OpenFin Workspace Platform

An OpenFin workspace application providing:
- FDC3 integration
- Workspace platform services
- Multi-window management
- Channel management
- Context sharing

**Run:**
```bash
npx nx serve macro-workspace
```

### 4. **market-data-server** - Market Data Service

A Node.js service providing market data streams:
- FX market data service
- Treasury market data service
- WebSocket support for real-time updates

## 📚 Libraries

### **@macro/logger** - Logging Library

A shared logging library using Pino for structured logging:

**Features:**
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Per-logger level configuration
- Global log level configuration
- Pretty printing in development
- JSON structured logging
- Works in both Angular and React applications

**Usage:**
```typescript
import { Logger, LogLevel } from '@macro/logger';

const logger = Logger.getLogger('MyComponent');
logger.info('Application started', { userId: 123 });
logger.error('Error occurred', { error: 'Something went wrong' });
```

### **@macro/macro-angular-grid** - Angular ag-Grid Wrapper

A wrapper component for ag-Grid in Angular applications:

**Features:**
- JSON column configuration support
- ag-Grid Enterprise features
- Automatic light/dark theme switching
- RxJS Subjects for row operations (add, update, delete)
- Default grid options (pagination, sorting, filtering)
- TypeScript type safety

**Usage:**
```typescript
import { MacroAngularGrid } from '@macro/macro-angular-grid';

@Component({
  template: `
    <lib-macro-angular-grid
      [columns]="columns"
      [rowData]="rowData">
    </lib-macro-angular-grid>
  `
})
```

### **@macro/macro-react-grid** - React ag-Grid Wrapper

A wrapper component for ag-Grid in React applications:

**Features:**
- JSON column configuration support
- ag-Grid Enterprise features
- Automatic light/dark theme switching
- RxJS Subjects for row operations
- Forward ref support for grid API access
- TypeScript type safety

**Usage:**
```typescript
import { MacroReactGrid } from '@macro/macro-react-grid';

<MacroReactGrid
  columns={columns}
  rowData={rowData}
  ref={gridRef}
/>
```

## 🎨 Theming

Both Angular and React applications support comprehensive theming:

### Light/Dark Theme Toggle
- System preference detection on first load
- Theme persistence in localStorage
- Automatic theme switching for:
  - ag-Grid (light/dark color schemes)
  - ag-Charts (theme-aware styling)
  - PrimeNG components (via darkModeSelector)
  - Shadcn UI components (via CSS variables)
  - Custom application styles

### Theme Implementation
- **Angular**: CSS variables with `.dark` class on document root
- **React**: Tailwind CSS with Shadcn UI CSS variables
- **Blue Theme**: Consistent blue color scheme across light and dark modes

## 🛠️ Technology Stack

### Frontend Frameworks
- **Angular** 20.3.0 - Standalone components, signals-ready
- **React** 19.0.0 - Latest React with hooks

### UI Libraries
- **ag-Grid** 34.3.1 - Enterprise data grid
- **ag-Charts** 12.3.1 - Enterprise charts
- **Recharts** 3.4.1 - React charting library
- **PrimeNG** 20.3.0 - Angular UI component library
- **Shadcn UI** - React component library (manually installed)

### Styling
- **Tailwind CSS** 4.1.17 - Utility-first CSS framework
- **CSS Variables** - Theme system
- **PostCSS** - CSS processing

### Routing
- **Angular Router** - Client-side routing for Angular
- **React Router** 6.29.0 - Client-side routing for React

### State Management
- **RxJS** 7.8.0 - Reactive programming
- **React Hooks** - useState, useEffect, useMemo, useCallback

### Build Tools
- **Nx** 22.0.3 - Monorepo build system
- **Vite** 7.0.0 - Fast build tool for React
- **Angular Build** 20.3.0 - Angular build system
- **TypeScript** 5.9.2 - Type-safe JavaScript

### Logging
- **Pino** 10.1.0 - Fast JSON logger
- **pino-pretty** 13.1.2 - Pretty printing for development

### Workspace
- **OpenFin** 42.102.4 - Desktop application platform
- **FDC3** 2.0.3 - Financial Desktop Connectivity

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd macro
```

2. Install dependencies:
```bash
npm install
```

3. Start development server for Angular app:
```bash
npx nx serve macro-angular
```

4. Start development server for React app:
```bash
npx nx serve macro-react
```

### Available Commands

#### Development
```bash
# Serve Angular application
npx nx serve macro-angular

# Serve React application
npx nx serve macro-react

# Serve workspace application
npx nx serve macro-workspace
```

#### Building
```bash
# Build Angular application
npx nx build macro-angular

# Build React application
npx nx build macro-react

# Build all applications
npx nx run-many --target=build --all
```

#### Testing
```bash
# Run tests for a specific project
npx nx test <project-name>

# Run tests for all projects
npx nx run-many --target=test --all

# Run e2e tests
npx nx e2e <project-name>-e2e
```

#### Linting
```bash
# Lint a specific project
npx nx lint <project-name>

# Lint all projects
npx nx run-many --target=lint --all
```

## 📁 Project Structure

```
macro/
├── apps/
│   ├── macro-angular/          # Angular market data application
│   │   ├── src/app/
│   │   │   ├── fx-market-data/         # FX market data component
│   │   │   ├── treasury-microstructure/ # Treasury microstructure component
│   │   │   └── app.ts                   # Main app component with routing
│   │   └── ...
│   ├── macro-react/            # React market data application
│   │   ├── src/app/
│   │   │   ├── treasury-market-data/    # Treasury market data component
│   │   │   ├── commodities-dashboard/  # Commodities dashboard component
│   │   │   └── app.tsx                  # Main app component with routing
│   │   ├── src/components/ui/           # Shadcn UI components
│   │   └── ...
│   ├── macro-workspace/        # OpenFin workspace application
│   └── market-data-server/     # Market data service
├── libs/
│   ├── logger/                 # Shared logging library
│   ├── macro-angular-grid/     # Angular ag-Grid wrapper
│   └── macro-react-grid/       # React ag-Grid wrapper
└── ...
```

## 🔧 Development Guidelines

### Adding New Components

#### Angular
1. Create component in `apps/macro-angular/src/app/`
2. Add route in `apps/macro-angular/src/app/app.routes.ts`
3. Add menu item in `apps/macro-angular/src/app/app.ts`

#### React
1. Create component in `apps/macro-react/src/app/`
2. Add route in `apps/macro-react/src/app/app.tsx`
3. Add menu item in the Menubar

### Theming
- Always use CSS variables for colors
- Test both light and dark themes
- Ensure ag-Grid and ag-Charts respond to theme changes
- Use MutationObserver for theme detection in libraries

### Grid Components
- Use `@macro/macro-angular-grid` or `@macro/macro-react-grid` for data grids
- Configure columns as JSON strings or TypeScript arrays
- Leverage RxJS Subjects for real-time updates

### Logging
- Use `@macro/logger` for all logging
- Set appropriate log levels
- Include context in log messages

## 📊 Features Overview

### Real-Time Data Simulation
- Simulated market data updates
- Realistic price movements
- Configurable update intervals
- Pause/play controls

### Data Visualization
- **ag-Charts**: Time-series charts, bar charts
- **Recharts**: Price charts, volume charts
- **ag-Grid**: Interactive data grids with sorting, filtering, pagination

### Navigation
- **Angular**: PrimeNG MenuBar with routing
- **React**: Shadcn UI Menubar with routing
- Active route highlighting

### Responsive Design
- Grid layouts that adapt to screen size
- Scrollable sections where needed
- Professional trading desk styling

## 🧪 Testing

### Unit Tests
```bash
npx nx test <project-name>
```

### E2E Tests
```bash
npx nx e2e <project-name>-e2e
```

## 📝 Code Quality

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type safety
- **Jest**: Unit testing
- **Playwright**: E2E testing

## 🔗 Useful Links

- [Nx Documentation](https://nx.dev)
- [Angular Documentation](https://angular.dev)
- [React Documentation](https://react.dev)
- [ag-Grid Documentation](https://www.ag-grid.com)
- [ag-Charts Documentation](https://www.ag-grid.com/charts)
- [PrimeNG Documentation](https://primeng.org)
- [Shadcn UI Documentation](https://ui.shadcn.com)
- [OpenFin Documentation](https://developers.openfin.co)
- [FDC3 Documentation](https://fdc3.finos.org)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📄 License

MIT

---

Built with ❤️ using Nx, Angular, React, and OpenFin
