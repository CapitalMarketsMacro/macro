import { LaunchService } from './launch.service';

jest.mock('@macro/logger', () => ({
  Logger: { getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) },
}));

jest.mock('./launch', () => ({ launchApp: jest.fn().mockResolvedValue(undefined) }));
import { launchApp } from './launch';

describe('LaunchService', () => {
  const app = { appId: 'fx-app', title: 'FX App' } as any;

  beforeEach(() => (launchApp as jest.Mock).mockClear());

  const make = (canLaunch: boolean) => {
    const entitlements = {
      ensureLoaded: jest.fn().mockResolvedValue(undefined),
      canLaunch: jest.fn().mockReturnValue(canLaunch),
      getRequiredEntitlements: jest.fn().mockReturnValue(['fx-trader']),
    } as any;
    const notifications = { warning: jest.fn() } as any;
    return { service: new LaunchService(entitlements, notifications), entitlements, notifications };
  };

  it('launches an app the user is entitled to', async () => {
    const { service } = make(true);
    const result = await service.launch(app);
    expect(result).toBe(true);
    expect(launchApp).toHaveBeenCalledWith(app);
  });

  it('blocks a non-entitled launch and notifies the user', async () => {
    const { service, notifications } = make(false);
    const result = await service.launch(app);
    expect(result).toBe(false);
    expect(launchApp).not.toHaveBeenCalled();
    expect(notifications.warning).toHaveBeenCalledTimes(1);
    const [title, body] = notifications.warning.mock.calls[0];
    expect(title).toBe('Access restricted');
    expect(body).toContain('FX App');
    expect(body).toContain('fx-trader');
  });

  it('ensures entitlements are loaded before deciding', async () => {
    const { service, entitlements } = make(true);
    await service.launch(app);
    expect(entitlements.ensureLoaded).toHaveBeenCalled();
  });
});
