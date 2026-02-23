import { launchApp } from './launch';
import type { App } from '@openfin/workspace';

// Mock @macro/logger
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

// Mock @openfin/workspace-platform -- inline jest.fn() in factory to avoid TDZ
jest.mock('@openfin/workspace-platform', () => ({
  getCurrentSync: jest.fn(),
  AppManifestType: {
    Snapshot: 'snapshot',
    View: 'view',
    External: 'external',
  },
}));

// Import the mocked module to get reference
import { getCurrentSync } from '@openfin/workspace-platform';

describe('launchApp', () => {
  let mockApplySnapshot: jest.Mock;
  let mockCreateView: jest.Mock;
  let mockLaunchExternalProcess: jest.Mock;
  let mockStartFromManifest: jest.Mock;

  beforeEach(() => {
    mockApplySnapshot = jest.fn();
    mockCreateView = jest.fn();
    mockLaunchExternalProcess = jest.fn();
    mockStartFromManifest = jest.fn();

    (getCurrentSync as jest.Mock).mockReturnValue({
      applySnapshot: mockApplySnapshot,
      createView: mockCreateView,
    });

    // Setup global fin mock
    (globalThis as any).fin = {
      System: {
        launchExternalProcess: mockLaunchExternalProcess,
      },
      Application: {
        startFromManifest: mockStartFromManifest,
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).fin;
    (getCurrentSync as jest.Mock).mockReset();
  });

  const makeApp = (
    manifestType: string,
    manifest?: string,
    appId = 'test-app',
  ): App =>
    ({
      appId,
      manifestType,
      manifest,
    }) as unknown as App;

  // ── no manifest ─────────────────────────────────────────────

  it('should return undefined when app has no manifest', async () => {
    const app = makeApp('view', undefined);

    const result = await launchApp(app);

    expect(result).toBeUndefined();
  });

  it('should not call any launch API when manifest is missing', async () => {
    const app = makeApp('view', undefined);

    await launchApp(app);

    expect(mockApplySnapshot).not.toHaveBeenCalled();
    expect(mockCreateView).not.toHaveBeenCalled();
    expect(mockLaunchExternalProcess).not.toHaveBeenCalled();
    expect(mockStartFromManifest).not.toHaveBeenCalled();
  });

  // ── Snapshot ────────────────────────────────────────────────

  describe('Snapshot manifest type', () => {
    it('should call platform.applySnapshot with manifest', async () => {
      const platform = {
        applySnapshot: mockApplySnapshot,
        createView: mockCreateView,
      };
      (getCurrentSync as jest.Mock).mockReturnValue(platform);
      mockApplySnapshot.mockResolvedValue(platform);

      const app = makeApp('snapshot', 'http://localhost/snapshot.json');

      const result = await launchApp(app);

      expect(mockApplySnapshot).toHaveBeenCalledWith(
        'http://localhost/snapshot.json',
      );
      expect(result).toBe(platform);
    });
  });

  // ── View ────────────────────────────────────────────────────

  describe('View manifest type', () => {
    it('should call platform.createView with manifestUrl', async () => {
      const mockView = { identity: { name: 'test' } };
      mockCreateView.mockResolvedValue(mockView);

      const app = makeApp('view', 'http://localhost/view.json');

      const result = await launchApp(app);

      expect(mockCreateView).toHaveBeenCalledWith({
        manifestUrl: 'http://localhost/view.json',
      });
      expect(result).toBe(mockView);
    });
  });

  // ── External ────────────────────────────────────────────────

  describe('External manifest type', () => {
    it('should call fin.System.launchExternalProcess', async () => {
      const mockProcess = { uuid: 'test-app' };
      mockLaunchExternalProcess.mockResolvedValue(mockProcess);

      const app = makeApp(
        'external',
        'C:\\Program Files\\app.exe',
        'my-app',
      );

      const result = await launchApp(app);

      expect(mockLaunchExternalProcess).toHaveBeenCalledWith({
        path: 'C:\\Program Files\\app.exe',
        uuid: 'my-app',
      });
      expect(result).toBe(mockProcess);
    });
  });

  // ── Default (Application) ──────────────────────────────────

  describe('default manifest type (Application)', () => {
    it('should call fin.Application.startFromManifest', async () => {
      const mockApplication = { identity: { uuid: 'test' } };
      mockStartFromManifest.mockResolvedValue(mockApplication);

      const app = makeApp('inline-appasset', 'http://localhost/app.json');

      const result = await launchApp(app);

      expect(mockStartFromManifest).toHaveBeenCalledWith(
        'http://localhost/app.json',
      );
      expect(result).toBe(mockApplication);
    });

    it('should handle unknown manifest types via default case', async () => {
      const mockApplication = { identity: { uuid: 'unknown' } };
      mockStartFromManifest.mockResolvedValue(mockApplication);

      const app = makeApp('some-unknown-type', 'http://localhost/app.json');

      const result = await launchApp(app);

      expect(mockStartFromManifest).toHaveBeenCalledWith(
        'http://localhost/app.json',
      );
      expect(result).toBe(mockApplication);
    });
  });
});
