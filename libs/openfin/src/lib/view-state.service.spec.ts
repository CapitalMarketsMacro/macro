import { ViewStateService } from './view-state.service';

// Silence logger output during tests
jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

describe('ViewStateService', () => {
  let service: ViewStateService;

  /** Helper to install a mock `fin.me` on globalThis. */
  function setFinMe(view: Record<string, unknown> | undefined) {
    (globalThis as any).fin = view ? { me: view } : undefined;
  }

  beforeEach(() => {
    service = new ViewStateService();
    delete (globalThis as any).fin;
    jest.useFakeTimers();
  });

  afterEach(() => {
    service.destroy();
    delete (globalThis as any).fin;
    jest.useRealTimers();
  });

  // ── restoreState ─────────────────────────────────────────────

  describe('restoreState', () => {
    it('should return empty object when fin is not available', async () => {
      const state = await service.restoreState();
      expect(state).toEqual({});
    });

    it('should return customData.viewState when fin.me.getOptions resolves', async () => {
      const viewState = { grid: { columnOrder: ['a', 'b'] } };
      setFinMe({
        getOptions: jest.fn().mockResolvedValue({ customData: { viewState } }),
      });

      const state = await service.restoreState();
      expect(state).toEqual(viewState);
    });

    it('should default to empty object when customData has no viewState', async () => {
      setFinMe({
        getOptions: jest.fn().mockResolvedValue({ customData: {} }),
      });

      const state = await service.restoreState();
      expect(state).toEqual({});
    });

    it('should default to empty object when customData is undefined', async () => {
      setFinMe({
        getOptions: jest.fn().mockResolvedValue({}),
      });

      const state = await service.restoreState();
      expect(state).toEqual({});
    });

    it('should handle getOptions error gracefully and return current state', async () => {
      setFinMe({
        getOptions: jest.fn().mockRejectedValue(new Error('OpenFin error')),
      });

      const state = await service.restoreState();
      expect(state).toEqual({});
    });
  });

  // ── saveState ────────────────────────────────────────────────

  describe('saveState', () => {
    it('should store data in internal state by namespace', async () => {
      await service.saveState('grid', { sortModel: [{ colId: 'px', sort: 'asc' }] });

      expect(service.getState('grid')).toEqual({ sortModel: [{ colId: 'px', sort: 'asc' }] });
    });

    it('should call fin.me.updateOptions when fin is available', async () => {
      const updateOptions = jest.fn().mockResolvedValue(undefined);
      setFinMe({ updateOptions });

      await service.saveState('grid', { colOrder: ['a'] });

      expect(updateOptions).toHaveBeenCalledWith({
        customData: { viewState: { grid: { colOrder: ['a'] } } },
      });
    });

    it('should not throw when fin is unavailable', async () => {
      await expect(service.saveState('ns', 'value')).resolves.toBeUndefined();
      expect(service.getState('ns')).toBe('value');
    });

    it('should handle updateOptions error gracefully', async () => {
      setFinMe({
        updateOptions: jest.fn().mockRejectedValue(new Error('fail')),
      });

      await expect(service.saveState('ns', 42)).resolves.toBeUndefined();
      // The state should still be stored locally
      expect(service.getState('ns')).toBe(42);
    });

    it('should merge multiple namespaces', async () => {
      await service.saveState('grid', { cols: [1] });
      await service.saveState('chart', { type: 'bar' });

      expect(service.getState('grid')).toEqual({ cols: [1] });
      expect(service.getState('chart')).toEqual({ type: 'bar' });
    });
  });

  // ── getState ─────────────────────────────────────────────────

  describe('getState', () => {
    it('should return undefined for unknown namespace', () => {
      expect(service.getState('nonexistent')).toBeUndefined();
    });

    it('should return stored data for a known namespace', async () => {
      await service.saveState('blotter', { filter: 'active' });
      expect(service.getState('blotter')).toEqual({ filter: 'active' });
    });
  });

  // ── enableAutoSave / disableAutoSave ─────────────────────────

  describe('enableAutoSave', () => {
    it('should call collectFn on each interval tick', () => {
      const collectFn = jest.fn().mockReturnValue({ ns1: 'data1' });

      service.enableAutoSave(collectFn, 1000);
      expect(collectFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(collectFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1000);
      expect(collectFn).toHaveBeenCalledTimes(2);
    });

    it('should merge collected data into internal state', () => {
      const collectFn = jest.fn().mockReturnValue({ grid: { sorted: true } });
      service.enableAutoSave(collectFn, 500);

      jest.advanceTimersByTime(500);

      expect(service.getState('grid')).toEqual({ sorted: true });
    });

    it('should call fin.me.updateOptions when fin is available', () => {
      const updateOptions = jest.fn().mockResolvedValue(undefined);
      setFinMe({ updateOptions });

      const collectFn = jest.fn().mockReturnValue({ ns: 'val' });
      service.enableAutoSave(collectFn, 500);

      jest.advanceTimersByTime(500);

      expect(updateOptions).toHaveBeenCalled();
    });

    it('should replace existing timer when called again', () => {
      const collectFn1 = jest.fn().mockReturnValue({});
      const collectFn2 = jest.fn().mockReturnValue({});

      service.enableAutoSave(collectFn1, 1000);
      service.enableAutoSave(collectFn2, 1000);

      jest.advanceTimersByTime(1000);

      expect(collectFn1).not.toHaveBeenCalled();
      expect(collectFn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('disableAutoSave', () => {
    it('should stop the interval', () => {
      const collectFn = jest.fn().mockReturnValue({});
      service.enableAutoSave(collectFn, 500);

      jest.advanceTimersByTime(500);
      expect(collectFn).toHaveBeenCalledTimes(1);

      service.disableAutoSave();
      jest.advanceTimersByTime(1000);
      expect(collectFn).toHaveBeenCalledTimes(1);
    });

    it('should be a no-op if no timer is running', () => {
      expect(() => service.disableAutoSave()).not.toThrow();
    });
  });

  // ── destroy ──────────────────────────────────────────────────

  describe('destroy', () => {
    it('should clear the auto-save timer', () => {
      const collectFn = jest.fn().mockReturnValue({});
      service.enableAutoSave(collectFn, 500);

      service.destroy();
      jest.advanceTimersByTime(1000);

      expect(collectFn).not.toHaveBeenCalled();
    });
  });
});
