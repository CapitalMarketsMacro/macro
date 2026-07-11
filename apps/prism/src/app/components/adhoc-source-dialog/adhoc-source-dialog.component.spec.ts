import { TestBed } from '@angular/core/testing';
import type { BlotterSource } from '@macro/prism-core';
import { DataSourceRepository } from '../../services/data-source-repository.service';
import { AdHocSourceDialogComponent } from './adhoc-source-dialog.component';

const ampsSource = (origin: 'catalog' | 'adhoc' = 'adhoc'): BlotterSource => ({
  id: 'amps-orders',
  name: 'AMPS Orders',
  category: 'Orders',
  transport: 'amps',
  mode: 'snapshot-update',
  connection: { transport: 'amps', url: 'ws://localhost:9008/amps/json' },
  topic: 'orders',
  filter: "/status <> 'DONE'",
  topN: 25,
  orderBy: '/orderDate DESC, /customerName ASC',
  keyField: 'orderId',
  columnMode: 'infer',
  origin,
});

describe('AdHocSourceDialogComponent AMPS result controls', () => {
  let repo: {
    addAdhoc: jest.Mock;
    updateAdhoc: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      addAdhoc: jest.fn((source) => ({
        ...source,
        id: 'adhoc-new',
        origin: 'adhoc',
      })),
      updateAdhoc: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AdHocSourceDialogComponent],
      providers: [{ provide: DataSourceRepository, useValue: repo }],
    })
      .overrideComponent(AdHocSourceDialogComponent, {
        set: { imports: [], template: '' },
      })
      .compileComponents();
  });

  function create(): AdHocSourceDialogComponent {
    return TestBed.createComponent(AdHocSourceDialogComponent)
      .componentInstance;
  }

  function patchValidAmps(component: AdHocSourceDialogComponent): void {
    component.form.patchValue({
      name: 'My AMPS Orders',
      category: 'Orders',
      transport: 'amps',
      mode: 'snapshot-update',
      url: 'ws://localhost:9008/amps/json',
      topic: 'orders',
      keyField: 'orderId',
    });
  }

  it('persists a positive Top N and trims Order by for an AMPS source', () => {
    const component = create();
    patchValidAmps(component);
    component.form.patchValue({ topN: 50, orderBy: '  /orderDate DESC  ' });

    component.save();

    expect(repo.addAdhoc).toHaveBeenCalledWith(
      expect.objectContaining({ topN: 50, orderBy: '/orderDate DESC' }),
    );
  });

  it('restores the AMPS result settings for edits and catalog duplicates', () => {
    const component = create();

    component.show(ampsSource('adhoc'));
    expect(component.form.controls.topN.value).toBe(25);
    expect(component.form.controls.orderBy.value).toBe(
      '/orderDate DESC, /customerName ASC',
    );
    component.save();
    expect(repo.updateAdhoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'amps-orders', topN: 25 }),
    );

    component.show(ampsSource('catalog'));
    expect(component.form.controls.name.value).toBe('AMPS Orders (copy)');
    component.save();
    expect(repo.addAdhoc).toHaveBeenCalledWith(
      expect.objectContaining({
        topN: 25,
        orderBy: '/orderDate DESC, /customerName ASC',
      }),
    );
  });

  it('omits stale AMPS result settings when another transport is saved', () => {
    const component = create();
    component.form.patchValue({
      name: 'NATS Orders',
      category: 'Orders',
      transport: 'nats',
      mode: 'snapshot-update',
      servers: 'ws://localhost:9222',
      topic: 'orders',
      keyField: 'orderId',
      topN: 10,
      orderBy: '/orderDate DESC',
    });

    component.save();

    const payload = repo.addAdhoc.mock.calls[0][0];
    expect(payload).not.toHaveProperty('topN');
    expect(payload).not.toHaveProperty('orderBy');
  });

  it('accepts only positive integer Top N values when provided', () => {
    const component = create();
    patchValidAmps(component);

    component.form.controls.topN.setValue(null);
    expect(component.canSave()).toBe(true);
    component.form.controls.topN.setValue(0);
    expect(component.canSave()).toBe(false);
    component.form.controls.topN.setValue(1.5);
    expect(component.canSave()).toBe(false);
    component.form.controls.topN.setValue(1);
    expect(component.canSave()).toBe(true);
  });
});
