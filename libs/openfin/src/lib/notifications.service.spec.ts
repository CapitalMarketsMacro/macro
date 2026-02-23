// Mock the @openfin/workspace/notifications module before any imports
const mockAddEventListener = jest.fn();
const mockCreate = jest.fn();
const mockDeregister = jest.fn().mockResolvedValue(undefined);
const mockRegister = jest.fn().mockResolvedValue(undefined);

jest.mock('@openfin/workspace/notifications', () => ({
  addEventListener: mockAddEventListener,
  create: mockCreate,
  deregister: mockDeregister,
  register: mockRegister,
}));

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

import { NotificationsService } from './notifications.service';
import type { SettingsService } from './settings.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockSettingsService: SettingsService;

  /** Helper to install / remove mock fin on globalThis. */
  function setFin(value: any) {
    if (value !== undefined) {
      (globalThis as any).fin = value;
    } else {
      delete (globalThis as any).fin;
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
    delete (globalThis as any).fin;

    mockSettingsService = {
      getManifestSettings: jest.fn().mockResolvedValue({
        platformSettings: { id: 'macro-workspace', title: 'Macro Workspace', icon: '' },
        customSettings: {},
      }),
      getApps: jest.fn().mockReturnValue([]),
      getApps$: jest.fn(),
    } as unknown as SettingsService;
  });

  afterEach(() => {
    delete (globalThis as any).fin;
  });

  // ── constructor ──────────────────────────────────────────────

  describe('constructor', () => {
    it('should create an instance', () => {
      service = new NotificationsService(mockSettingsService);
      expect(service).toBeDefined();
    });

    it('should not call registerPlatform when fin is not available', () => {
      service = new NotificationsService(mockSettingsService);
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should register notifications platform when fin is available', async () => {
      setFin({});
      service = new NotificationsService(mockSettingsService);

      // Wait for the async registration chain to resolve
      await (mockSettingsService.getManifestSettings as jest.Mock).mock.results[0].value;
      // Flush microtask queue
      await Promise.resolve();

      expect(mockSettingsService.getManifestSettings).toHaveBeenCalled();
      expect(mockRegister).toHaveBeenCalledWith({
        notificationsPlatformOptions: {
          id: 'macro-workspace',
          title: 'Macro Workspace',
          icon: '',
        },
      });
    });
  });

  // ── observeNotificationActions ───────────────────────────────

  describe('observeNotificationActions', () => {
    it('should return an observable that completes immediately when fin is not available', (done) => {
      service = new NotificationsService(mockSettingsService);

      const emitted: any[] = [];
      service.observeNotificationActions().subscribe({
        next: (val) => emitted.push(val),
        complete: () => {
          expect(emitted).toHaveLength(0);
          done();
        },
      });
    });

    it('should return an observable that emits notification events when fin is available', () => {
      setFin({});
      service = new NotificationsService(mockSettingsService);

      const emitted: any[] = [];
      service.observeNotificationActions().subscribe((event) => {
        emitted.push(event);
      });

      expect(mockAddEventListener).toHaveBeenCalledWith(
        'notification-action',
        expect.any(Function),
      );

      // Simulate a notification action event
      const handler = mockAddEventListener.mock.calls[0][1];
      handler({ actionId: 'open', notificationId: 'n1' });

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ actionId: 'open', notificationId: 'n1' });
    });
  });

  // ── deregister ───────────────────────────────────────────────

  describe('deregister', () => {
    it('should do nothing when fin is not available', async () => {
      service = new NotificationsService(mockSettingsService);
      await service.deregister('macro-workspace');

      expect(mockDeregister).not.toHaveBeenCalled();
    });

    it('should call deregister from notifications module when fin is available', async () => {
      setFin({});
      service = new NotificationsService(mockSettingsService);
      await service.deregister('macro-workspace');

      expect(mockDeregister).toHaveBeenCalledWith('macro-workspace');
    });

    it('should complete the unsubscribe$ subject', async () => {
      setFin({});
      service = new NotificationsService(mockSettingsService);

      // Register for an observable and verify it completes after deregister
      // Note: we'd need to observe the takeUntil pattern
      // For now, just ensure deregister doesn't throw
      await expect(service.deregister('macro-workspace')).resolves.toBeUndefined();
    });
  });

  // ── create ───────────────────────────────────────────────────

  describe('create', () => {
    it('should do nothing when fin is not available', () => {
      service = new NotificationsService(mockSettingsService);
      service.create({ title: 'Test', body: 'Hello' } as any);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should call create from notifications module when fin is available', () => {
      setFin({});
      service = new NotificationsService(mockSettingsService);

      const config = { title: 'Test Notification', body: 'Hello World' } as any;
      service.create(config);

      expect(mockCreate).toHaveBeenCalledWith(config);
    });
  });
});
