import { fireEvent, render, screen } from '@testing-library/react';
import type { BlotterSource } from '@macro/prism-core';
import { DataSourceProvider } from '../data-source-context';
import { AdHocSourceDialog } from './adhoc-source-dialog';

const ampsSource: BlotterSource = {
  id: 'amps-orders',
  name: 'AMPS Orders',
  category: 'Orders',
  transport: 'amps',
  mode: 'snapshot-update',
  connection: { transport: 'amps', url: 'ws://localhost:9008/amps/json' },
  topic: 'orders',
  keyField: 'orderId',
  columnMode: 'infer',
  topN: 25,
  orderBy: '/updatedAt DESC',
  origin: 'catalog',
};

describe('AdHocSourceDialog AMPS result set controls', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue([]) }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('restores, validates, trims and saves Top N and Order By', () => {
    const onSaved = vi.fn();
    render(
      <DataSourceProvider>
        <AdHocSourceDialog
          open
          source={ampsSource}
          onOpenChange={vi.fn()}
          onSaved={onSaved}
        />
      </DataSourceProvider>,
    );

    const topN = screen.getByPlaceholderText('e.g. 500') as HTMLInputElement;
    const orderBy = screen.getByPlaceholderText(
      '/updatedAt DESC, /symbol ASC',
    ) as HTMLInputElement;
    const openButton = screen.getByRole('button', {
      name: 'Open',
    }) as HTMLButtonElement;

    expect(topN.value).toBe('25');
    expect(orderBy.value).toBe('/updatedAt DESC');

    fireEvent.change(topN, { target: { value: '2.5' } });
    expect(openButton.disabled).toBe(true);
    expect(
      screen.getByText('Enter a whole number greater than zero.'),
    ).toBeTruthy();

    fireEvent.change(topN, { target: { value: '100' } });
    fireEvent.change(orderBy, {
      target: { value: '  /updatedAt DESC, /orderId TEXT  ' },
    });
    expect(openButton.disabled).toBe(false);
    fireEvent.click(openButton);

    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        topN: 100,
        orderBy: '/updatedAt DESC, /orderId TEXT',
      }),
    );
  });
});
