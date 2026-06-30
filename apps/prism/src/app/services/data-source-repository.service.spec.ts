import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DataSourceRepository } from './data-source-repository.service';
import type { BlotterSource } from '../models/blotter-source';

const seedSource = (over: Partial<BlotterSource> = {}): BlotterSource => ({
  id: 'a',
  name: 'A',
  category: 'FX',
  transport: 'nats',
  mode: 'append',
  connection: { transport: 'nats', servers: 'ws://x' },
  topic: 't',
  columnMode: 'infer',
  ...over,
});

describe('DataSourceRepository', () => {
  let repo: DataSourceRepository;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(DataSourceRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the seed catalog and stamps origin=catalog', async () => {
    const p = repo.loadCatalog();
    httpMock.expectOne('/data-sources.json').flush([seedSource()]);
    await p;
    expect(repo.all()).toHaveLength(1);
    expect(repo.all()[0].origin).toBe('catalog');
  });

  it('degrades to an empty catalog when the seed file fails to load', async () => {
    const p = repo.loadCatalog();
    httpMock.expectOne('/data-sources.json').error(new ProgressEvent('network'));
    await p;
    expect(repo.all()).toHaveLength(0);
  });

  it('adds, updates and removes ad-hoc sources, persisting to localStorage', () => {
    const created = repo.addAdhoc(seedSource({ name: 'My FX', mode: 'streaming', keyField: 'symbol' }));
    expect(created.id).toContain('adhoc-');
    expect(created.origin).toBe('adhoc');
    expect(repo.adhocSources()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('prism.adhoc-sources.v1') as string)).toHaveLength(1);

    repo.updateAdhoc({ ...created, name: 'Renamed' });
    expect(repo.get(created.id)?.name).toBe('Renamed');

    repo.removeAdhoc(created.id);
    expect(repo.adhocSources()).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('prism.adhoc-sources.v1') as string)).toHaveLength(0);
  });

  it('filters by transport / mode and groups by category', () => {
    repo.addAdhoc(seedSource({ name: 'A', category: 'FX', transport: 'nats', mode: 'streaming', keyField: 's' }));
    repo.addAdhoc(
      seedSource({ name: 'B', category: 'Rates', transport: 'amps', mode: 'append', connection: { transport: 'amps', url: 'ws://u/amps/json' } }),
    );
    expect(repo.byTransport('nats')).toHaveLength(1);
    expect(repo.byMode('append')).toHaveLength(1);
    expect(repo.groupedByCategory().map((g) => g.category)).toEqual(expect.arrayContaining(['FX', 'Rates']));
  });
});
