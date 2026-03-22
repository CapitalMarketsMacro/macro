import { AnalyticsNatsService, getAnalyticsNats } from './analytics-nats.service';

// ── Mocks ────────────────────────────────────────────────────────────

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockPublish = jest.fn();
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('@macro/nats', () => ({
  NatsClient: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    publish: mockPublish,
    disconnect: mockDisconnect,
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

// ── Tests ────────────────────────────────────────────────────────────

describe('AnalyticsNatsService', () => {
  let service: AnalyticsNatsService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fin.System.getEnvironmentVariable
    (globalThis as any).fin = {
      System: {
        getEnvironmentVariable: jest.fn().mockResolvedValue('testuser'),
      },
    };
    service = new AnalyticsNatsService();
  });

  afterEach(() => {
    delete (globalThis as any).fin;
  });

  // ── connect ──

  describe('connect', () => {
    it('should connect to NATS', async () => {
      await service.connect();
      expect(mockConnect).toHaveBeenCalledWith({
        servers: 'ws://MontuNobleNumbat2404:8224',
      });
    });

    it('should not connect if already connected', async () => {
      await service.connect();
      await service.connect();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should not connect if currently connecting', async () => {
      // Start two connections simultaneously
      const p1 = service.connect();
      const p2 = service.connect();
      await Promise.all([p1, p2]);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should handle connection failure gracefully', async () => {
      mockConnect.mockRejectedValueOnce(new Error('refused'));
      await service.connect(); // Should not throw
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  // ── publish ──

  describe('publish', () => {
    it('should auto-connect and publish', async () => {
      await service.publish({
        source: 'Platform',
        type: 'Lifecycle',
        action: 'Init',
      });

      expect(mockConnect).toHaveBeenCalled();
      expect(mockPublish).toHaveBeenCalledWith(
        'macro.analytics.testuser.platform.lifecycle.init',
        expect.objectContaining({
          user: 'testuser',
          source: 'Platform',
          type: 'Lifecycle',
          action: 'Init',
        }),
      );
    });

    it('should include timestamp in payload', async () => {
      await service.publish({ source: 'S', type: 'T', action: 'A' });

      const payload = mockPublish.mock.calls[0][1];
      expect(payload.timestamp).toBeDefined();
      expect(new Date(payload.timestamp).getTime()).not.toBeNaN();
    });

    it('should include optional fields', async () => {
      await service.publish({
        source: 'Store',
        type: 'App',
        action: 'Launch',
        value: 'FX Market Data',
        entityId: { uuid: 'test-uuid', name: 'test-name' },
        data: { appId: 'fx-app' },
      });

      const payload = mockPublish.mock.calls[0][1];
      expect(payload.value).toBe('FX Market Data');
      expect(payload.entityId).toEqual({ uuid: 'test-uuid', name: 'test-name' });
      expect(payload.data).toEqual({ appId: 'fx-app' });
    });

    it('should sanitize topic segments', async () => {
      await service.publish({
        source: 'My Source!',
        type: 'Type @#$',
        action: 'Some Action',
      });

      const topic = mockPublish.mock.calls[0][0];
      expect(topic).toBe('macro.analytics.testuser.my_source_.type____.some_action');
    });

    it('should cache username after first call', async () => {
      await service.publish({ source: 'S', type: 'T', action: 'A' });
      await service.publish({ source: 'S', type: 'T', action: 'B' });

      expect(fin.System.getEnvironmentVariable).toHaveBeenCalledTimes(1);
    });

    it('should use "unknown" if getEnvironmentVariable fails', async () => {
      (fin.System.getEnvironmentVariable as jest.Mock).mockRejectedValueOnce(new Error('denied'));
      service = new AnalyticsNatsService();

      await service.publish({ source: 'S', type: 'T', action: 'A' });

      const topic = mockPublish.mock.calls[0][0];
      expect(topic).toContain('unknown');
    });

    it('should use "unknown" if USERNAME is empty', async () => {
      (fin.System.getEnvironmentVariable as jest.Mock).mockResolvedValueOnce('');
      service = new AnalyticsNatsService();

      await service.publish({ source: 'S', type: 'T', action: 'A' });

      const topic = mockPublish.mock.calls[0][0];
      expect(topic).toContain('unknown');
    });

    it('should not publish if connection failed', async () => {
      mockConnect.mockRejectedValueOnce(new Error('refused'));

      await service.publish({ source: 'S', type: 'T', action: 'A' });

      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('should handle publish errors gracefully', async () => {
      mockPublish.mockImplementationOnce(() => { throw new Error('pub error'); });

      await service.publish({ source: 'S', type: 'T', action: 'A' });
      // Should not throw
    });
  });

  // ── disconnect ──

  describe('disconnect', () => {
    it('should disconnect when connected', async () => {
      await service.connect();
      await service.disconnect();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should no-op when not connected', async () => {
      await service.disconnect();
      expect(mockDisconnect).not.toHaveBeenCalled();
    });
  });

  // ── getAnalyticsNats singleton ──

  describe('getAnalyticsNats', () => {
    it('should return same instance', () => {
      const a = getAnalyticsNats();
      const b = getAnalyticsNats();
      expect(a).toBe(b);
    });

    it('should return an AnalyticsNatsService instance', () => {
      const instance = getAnalyticsNats();
      expect(instance).toBeDefined();
      expect(typeof instance.publish).toBe('function');
      expect(typeof instance.connect).toBe('function');
      expect(typeof instance.disconnect).toBe('function');
    });
  });
});
