import { toTaskbarIcon } from './icon-utils';

describe('toTaskbarIcon', () => {
  it('resolves the root favicon.ico for a themed svg under a subpath (the regression case)', () => {
    expect(
      toTaskbarIcon('http://localhost:4202/MacroThemeCondensed/assets/favicon.svg'),
    ).toBe('http://localhost:4202/favicon.ico');
  });

  it('resolves the root favicon.ico for an /icons/ path (the original case still works)', () => {
    expect(toTaskbarIcon('http://localhost:4202/icons/platform-taskbar.svg')).toBe(
      'http://localhost:4202/favicon.ico',
    );
  });

  it('preserves the origin (host + port) when resolving', () => {
    expect(toTaskbarIcon('https://workspace.example.com/assets/logo.svg')).toBe(
      'https://workspace.example.com/favicon.ico',
    );
  });

  it('is idempotent for an icon already at the root favicon.ico', () => {
    expect(toTaskbarIcon('http://localhost:4202/favicon.ico')).toBe(
      'http://localhost:4202/favicon.ico',
    );
  });

  it('falls back without throwing for a relative icon (no parseable origin)', () => {
    expect(toTaskbarIcon('icon.png')).toBe('favicon.ico');
  });
});
