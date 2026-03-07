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
import type { PlatformSettings } from './types';

const platformSettings: PlatformSettings = {
  id: 'macro-workspace',
  title: 'Macro Workspace',
  icon: '',
};

describe('NotificationsService', () => {
  let service: NotificationsService;

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
  });

  afterEach(() => {
    delete (globalThis as any).fin;
  });

  // ── constructor ──────────────────────────────────────────────

  describe('constructor', () => {
    it('should create an instance', () => {
      service = new NotificationsService();
      expect(service).toBeDefined();
    });
  });

  // ── register ─────────────────────────────────────────────────

  describe('register', () => {
    it('should not call registerPlatform when fin is not available', async () => {
      service = new NotificationsService();
      await service.register(platformSettings);
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should register notifications platform when fin is available', async () => {
      setFin({});
      service = new NotificationsService();
      await service.register(platformSettings);

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
      service = new NotificationsService();

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
      service = new NotificationsService();

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
      service = new NotificationsService();
      await service.deregister();

      expect(mockDeregister).not.toHaveBeenCalled();
    });

    it('should do nothing when platformId has not been set', async () => {
      setFin({});
      service = new NotificationsService();
      await service.deregister();

      expect(mockDeregister).not.toHaveBeenCalled();
    });

    it('should call deregister with stored platformId after registration', async () => {
      setFin({});
      service = new NotificationsService();
      await service.register(platformSettings);
      await service.deregister();

      expect(mockDeregister).toHaveBeenCalledWith('macro-workspace');
    });

    it('should not throw', async () => {
      setFin({});
      service = new NotificationsService();
      await service.register(platformSettings);
      await expect(service.deregister()).resolves.toBeUndefined();
    });
  });

  // ── create ───────────────────────────────────────────────────

  describe('create', () => {
    it('should do nothing when fin is not available', () => {
      service = new NotificationsService();
      service.create({ title: 'Test', body: 'Hello' } as any);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should call create from notifications module when fin is available', () => {
      setFin({});
      service = new NotificationsService();

      const config = { title: 'Test Notification', body: 'Hello World' } as any;
      service.create(config);

      expect(mockCreate).toHaveBeenCalledWith(config);
    });
  });

  // ── notify (level-based) ──────────────────────────────────────

  describe('notify', () => {
    beforeEach(async () => {
      setFin({});
      service = new NotificationsService();
      await service.register(platformSettings);
      mockCreate.mockClear();
    });

    it.each([
      ['info', 'blue', 'Info'],
      ['success', 'green', 'Success'],
      ['warning', 'yellow', 'Warning'],
      ['error', 'red', 'Error'],
      ['critical', 'magenta', 'Critical'],
    ] as const)('should send %s notification with %s indicator', (level, color, label) => {
      service.notify(level as any, { title: 'Test', body: 'Body' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test',
          body: 'Body',
          indicator: { color, text: label },
        }),
      );
    });

    it('should use platform settings for icon and stream', () => {
      service.info('Title', 'Body');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: '',
          stream: { id: 'macro-workspace', displayName: 'Macro Workspace', appId: 'macro-workspace' },
        }),
      );
    });

    it('should allow overriding source and icon', () => {
      service.warning('Title', 'Body', { source: 'My App', icon: 'custom.svg' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'custom.svg',
          stream: expect.objectContaining({ displayName: 'My App' }),
        }),
      );
    });
  });

  // ── convenience methods ────────────────────────────────────────

  describe('convenience methods', () => {
    beforeEach(async () => {
      setFin({});
      service = new NotificationsService();
      await service.register(platformSettings);
      mockCreate.mockClear();
    });

    it('info() should call notify with info level', () => {
      service.info('Title', 'Body');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ indicator: { color: 'blue', text: 'Info' } }),
      );
    });

    it('success() should call notify with success level', () => {
      service.success('Title', 'Body');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ indicator: { color: 'green', text: 'Success' } }),
      );
    });

    it('warning() should call notify with warning level', () => {
      service.warning('Title', 'Body');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ indicator: { color: 'yellow', text: 'Warning' } }),
      );
    });

    it('error() should call notify with error level', () => {
      service.error('Title', 'Body');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ indicator: { color: 'red', text: 'Error' } }),
      );
    });

    it('critical() should call notify with critical level', () => {
      service.critical('Title', 'Body');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ indicator: { color: 'magenta', text: 'Critical' } }),
      );
    });

    it('should do nothing when fin is not available', () => {
      delete (globalThis as any).fin;
      service = new NotificationsService();
      service.info('Title', 'Body');
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
