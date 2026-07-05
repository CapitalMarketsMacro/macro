import { TestBed } from '@angular/core/testing';
import type { GridApi, IStatusPanelParams } from 'ag-grid-community';
import { MacroAdvancedFilterToggleComponent, MacroQuickFilterToggleComponent } from './filter-toggles.component';

function createMockGridApi(options: Record<string, unknown> = {}): GridApi {
  return {
    getGridOption: jest.fn((key: string) => options[key]),
    setGridOption: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
  } as unknown as GridApi;
}

function toggleEvent(checked: boolean): Event {
  return { target: { checked } } as unknown as Event;
}

function inputEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}

describe('MacroQuickFilterToggleComponent', () => {
  function create(api: GridApi): MacroQuickFilterToggleComponent {
    const fixture = TestBed.createComponent(MacroQuickFilterToggleComponent);
    const comp = fixture.componentInstance;
    comp.agInit({ api } as IStatusPanelParams);
    return comp;
  }

  it('initializes OFF with empty text by default', () => {
    const comp = create(createMockGridApi());
    expect(comp.on).toBe(false);
    expect(comp.text).toBe('');
  });

  it('initializes ON when a consumer seeded quickFilterText via gridOptions', () => {
    const comp = create(createMockGridApi({ quickFilterText: 'ust' }));
    expect(comp.on).toBe(true);
    expect(comp.text).toBe('ust');
  });

  it('checking the toggle reveals the box without applying a stale filter', () => {
    const api = createMockGridApi();
    const comp = create(api);

    comp.onToggle(toggleEvent(true));

    expect(comp.on).toBe(true);
    expect(api.setGridOption).not.toHaveBeenCalled();
  });

  it('typing drives quickFilterText', () => {
    const api = createMockGridApi();
    const comp = create(api);
    comp.onToggle(toggleEvent(true));

    comp.onText(inputEvent('ZTU6'));

    expect(comp.text).toBe('ZTU6');
    expect(api.setGridOption).toHaveBeenCalledWith('quickFilterText', 'ZTU6');
  });

  it('unchecking clears the filter so nothing hidden lingers', () => {
    const api = createMockGridApi({ quickFilterText: 'ust' });
    const comp = create(api);

    comp.onToggle(toggleEvent(false));

    expect(comp.text).toBe('');
    expect(api.setGridOption).toHaveBeenCalledWith('quickFilterText', '');
  });

  it('Escape clears the filter text', () => {
    const api = createMockGridApi();
    const comp = create(api);
    comp.onToggle(toggleEvent(true));
    comp.onText(inputEvent('bond'));

    comp.clear();

    expect(comp.text).toBe('');
    expect(api.setGridOption).toHaveBeenLastCalledWith('quickFilterText', '');
  });
});

describe('MacroAdvancedFilterToggleComponent', () => {
  function create(api: GridApi): MacroAdvancedFilterToggleComponent {
    const fixture = TestBed.createComponent(MacroAdvancedFilterToggleComponent);
    const comp = fixture.componentInstance;
    comp.agInit({ api } as IStatusPanelParams);
    return comp;
  }

  it('initializes from the current enableAdvancedFilter', () => {
    expect(create(createMockGridApi()).on).toBe(false);
    expect(create(createMockGridApi({ enableAdvancedFilter: true })).on).toBe(true);
  });

  it('flips enableAdvancedFilter when toggled', () => {
    const api = createMockGridApi();
    const comp = create(api);

    comp.onToggle(toggleEvent(true));
    expect(api.setGridOption).toHaveBeenCalledWith('enableAdvancedFilter', true);

    comp.onToggle(toggleEvent(false));
    expect(api.setGridOption).toHaveBeenCalledWith('enableAdvancedFilter', false);
  });

  it('stays in sync when advanced filter is flipped elsewhere', () => {
    const options: Record<string, unknown> = { enableAdvancedFilter: false };
    const api = createMockGridApi(options);
    const comp = create(api);
    expect(comp.on).toBe(false);

    const [eventName, handler] = (api.addEventListener as jest.Mock).mock.calls[0];
    expect(eventName).toBe('advancedFilterEnabledChanged');
    options['enableAdvancedFilter'] = true;
    handler();

    expect(comp.on).toBe(true);
  });

  it('removes its grid event listener on destroy', () => {
    const api = createMockGridApi();
    const comp = create(api);

    comp.ngOnDestroy();

    const [eventName, handler] = (api.addEventListener as jest.Mock).mock.calls[0];
    expect(api.removeEventListener).toHaveBeenCalledWith(eventName, handler);
  });

  it('does not touch the API on destroy when the grid is already destroyed', () => {
    const api = createMockGridApi();
    (api.isDestroyed as jest.Mock).mockReturnValue(true);
    const comp = create(api);

    comp.ngOnDestroy();

    expect(api.removeEventListener).not.toHaveBeenCalled();
  });
});
