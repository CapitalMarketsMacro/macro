import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppContent } from './app';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    expect(baseElement).toBeTruthy();
  });

  it('should render navigation menu', () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    expect(getByText('Treasury Market Data')).toBeTruthy();
    expect(getByText('Commodities Dashboard')).toBeTruthy();
  });
});
