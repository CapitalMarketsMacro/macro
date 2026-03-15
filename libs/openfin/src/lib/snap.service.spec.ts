import { SnapService } from './snap.service';

// Mock @openfin/snap-sdk
const mockStart = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockEnableAutoWindowRegistration = jest.fn().mockResolvedValue(jest.fn().mockResolvedValue(undefined));
const mockDecorateSnapshot = jest.fn().mockImplementation((s) => Promise.resolve({ ...s, snap: { clients: [], connections: [], version: '1' } }));
const mockPrepareToApplySnapshot = jest.fn().mockResolvedValue(undefined);
const mockApplySnapshot = jest.fn().mockResolvedValue(undefined);

jest.mock('@openfin/snap-sdk', () => ({
  SnapServer: jest.fn().mockImplementation(() => ({
    start: mockStart,
    stop: mockStop,
    enableAutoWindowRegistration: mockEnableAutoWindowRegistration,
    decorateSnapshot: mockDecorateSnapshot,
    prepareToApplySnapshot: mockPrepareToApplySnapshot,
    applySnapshot: mockApplySnapshot,
    getSnapServerStatus: jest.fn().mockReturnValue('connected'),
  })),
}));

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

describe('SnapService', () => {
  let service: SnapService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SnapService();
  });

  describe('init', () => {
    it('should start the snap server and enable auto window registration', async () => {
      await service.init('test-platform');

      expect(mockStart).toHaveBeenCalledWith({});
      expect(mockEnableAutoWindowRegistration).toHaveBeenCalled();
      expect(service.isRunning).toBe(true);
    });

    it('should pass through server options from settings', async () => {
      await service.init('test-platform', {
        serverOptions: {
          showDebug: true,
          keyToStick: 'ctrl',
          theme: 'snap-dark1',
        },
      });

      expect(mockStart).toHaveBeenCalledWith({
        showDebug: true,
        keyToStick: 'ctrl',
        theme: 'snap-dark1',
      });
    });

    it('should not initialize when disabled', async () => {
      await service.init('test-platform', { enabled: false });

      expect(mockStart).not.toHaveBeenCalled();
      expect(service.isRunning).toBe(false);
    });

    it('should handle start errors gracefully', async () => {
      mockStart.mockRejectedValueOnce(new Error('Start failed'));

      await service.init('test-platform');

      expect(service.isRunning).toBe(false);
    });
  });

  describe('decorateSnapshot', () => {
    it('should decorate snapshot when server is running', async () => {
      await service.init('test-platform');

      const snapshot = { windows: [] } as any;
      const result = await service.decorateSnapshot(snapshot);

      expect(mockDecorateSnapshot).toHaveBeenCalledWith(snapshot);
      expect(result).toHaveProperty('snap');
    });

    it('should return original snapshot when server is not running', async () => {
      const snapshot = { windows: [] } as any;
      const result = await service.decorateSnapshot(snapshot);

      expect(mockDecorateSnapshot).not.toHaveBeenCalled();
      expect(result).toBe(snapshot);
    });

    it('should return original snapshot on error', async () => {
      await service.init('test-platform');
      mockDecorateSnapshot.mockRejectedValueOnce(new Error('Decorate failed'));

      const snapshot = { windows: [] } as any;
      const result = await service.decorateSnapshot(snapshot);

      expect(result).toBe(snapshot);
    });
  });

  describe('prepareToApplySnapshot', () => {
    it('should call server prepareToApplySnapshot when running', async () => {
      await service.init('test-platform');
      const payload = { snapshot: { windows: [] } } as any;

      await service.prepareToApplySnapshot(payload);

      expect(mockPrepareToApplySnapshot).toHaveBeenCalledWith(payload);
    });

    it('should no-op when server is not running', async () => {
      await service.prepareToApplySnapshot({} as any);

      expect(mockPrepareToApplySnapshot).not.toHaveBeenCalled();
    });
  });

  describe('applySnapshot', () => {
    it('should call server applySnapshot when running', async () => {
      await service.init('test-platform');
      const snapshot = { windows: [], snap: { clients: [] } } as any;

      await service.applySnapshot(snapshot);

      expect(mockApplySnapshot).toHaveBeenCalledWith(snapshot);
    });

    it('should no-op when server is not running', async () => {
      await service.applySnapshot({} as any);

      expect(mockApplySnapshot).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop the server and clean up', async () => {
      await service.init('test-platform');
      expect(service.isRunning).toBe(true);

      await service.stop();

      expect(mockStop).toHaveBeenCalled();
      expect(service.isRunning).toBe(false);
    });

    it('should no-op when server is not running', async () => {
      await service.stop();

      expect(mockStop).not.toHaveBeenCalled();
    });

    it('should handle stop errors gracefully', async () => {
      await service.init('test-platform');
      mockStop.mockRejectedValueOnce(new Error('Stop failed'));

      await service.stop();

      expect(service.isRunning).toBe(false);
    });
  });
});
