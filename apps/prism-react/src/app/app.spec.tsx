import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DataSourceProvider } from './data-source-context';
import { SourceCatalog } from './components/source-catalog';

describe('SourceCatalog', () => {
  it('renders the catalog header and the add-source action', () => {
    render(
      <MemoryRouter>
        <DataSourceProvider>
          <SourceCatalog />
        </DataSourceProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Data Sources')).toBeTruthy();
    expect(screen.getByText(/Add ad-hoc source/)).toBeTruthy();
  });
});
