import { TestBed } from '@angular/core/testing';
import type { GridApi, IStatusPanelParams } from 'ag-grid-community';
import { MacroGroupingToggleComponent, MacroPivotToggleComponent } from './group-pivot-toggles.component';

function createMockGridApi(options: Record<string, unknown> = {}): GridApi {
  return {
    getGridOption: jest.fn((key: string) => options[key]),
    setGridOption: jest.fn(),
    applyColumnState: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
  } as unknown as GridApi;
}

function toggleEvent(checked: boolean): Event {
  return { target: { checked } } as unknown as Event;
}

describe('MacroGroupingToggleComponent', () => {
  function create(api: GridApi): MacroGroupingToggleComponent {
    const fixture = TestBed.createComponent(MacroGroupingToggleComponent);
    const comp = fixture.componentInstance;
    comp.agInit({ api } as IStatusPanelParams);
    return comp;
  }

  it('initializes OFF when the row-group panel is hidden (default)', () => {
    const comp = create(createMockGridApi());
    expect(comp.on).toBe(false);
  });

  it('initializes ON when a consumer already shows the row-group panel', () => {
    const comp = create(createMockGridApi({ rowGroupPanelShow: 'always' }));
    expect(comp.on).toBe(true);
  });

  it('shows the row-group panel when toggled ON (without touching existing groups)', () => {
    const api = createMockGridApi();
    const comp = create(api);

    comp.onToggle(toggleEvent(true));

    expect(api.setGridOption).toHaveBeenCalledWith('rowGroupPanelShow', 'always');
    expect(api.applyColumnState).not.toHaveBeenCalled();
  });

  it('hides the panel AND clears active row groups when toggled OFF', () => {
    const api = createMockGridApi({ rowGroupPanelShow: 'always' });
    const comp = create(api);

    comp.onToggle(toggleEvent(false));

    expect(api.setGridOption).toHaveBeenCalledWith('rowGroupPanelShow', 'never');
    expect(api.applyColumnState).toHaveBeenCalledWith({ defaultState: { rowGroup: false } });
  });
});

describe('MacroPivotToggleComponent', () => {
  function create(api: GridApi): MacroPivotToggleComponent {
    const fixture = TestBed.createComponent(MacroPivotToggleComponent);
    const comp = fixture.componentInstance;
    comp.agInit({ api } as IStatusPanelParams);
    return comp;
  }

  it('initializes from the current pivotMode', () => {
    expect(create(createMockGridApi()).on).toBe(false);
    expect(create(createMockGridApi({ pivotMode: true })).on).toBe(true);
  });

  it('flips pivotMode when toggled', () => {
    const api = createMockGridApi();
    const comp = create(api);

    comp.onToggle(toggleEvent(true));
    expect(api.setGridOption).toHaveBeenCalledWith('pivotMode', true);

    comp.onToggle(toggleEvent(false));
    expect(api.setGridOption).toHaveBeenCalledWith('pivotMode', false);
  });

  it('stays in sync when pivot mode is flipped elsewhere (e.g. the columns tool panel)', () => {
    const options: Record<string, unknown> = { pivotMode: false };
    const api = createMockGridApi(options);
    const comp = create(api);
    expect(comp.on).toBe(false);

    // The component subscribes to columnPivotModeChanged; simulate the tool panel flipping pivot on.
    const [eventName, handler] = (api.addEventListener as jest.Mock).mock.calls[0];
    expect(eventName).toBe('columnPivotModeChanged');
    options['pivotMode'] = true;
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
