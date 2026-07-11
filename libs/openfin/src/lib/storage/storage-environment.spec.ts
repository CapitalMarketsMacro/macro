import {
  LOCAL_STORAGE_ENVIRONMENT,
  STORAGE_ENV_CHOICE_KEY,
  getSavedStorageEnvironmentChoice,
  listStorageEnvironments,
  resolveStorageEnvironment,
  saveStorageEnvironmentChoice,
} from './storage-environment';
import type { StorageSettings } from './storage-types';

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

// Tests run in a node environment — provide the browser localStorage (repo convention).
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
});

const SETTINGS: StorageSettings = {
  defaultEnvironment: 'dev',
  environments: {
    dev: {
      mode: 'rest',
      baseUrl: 'http://localhost:3000/workspace/v1',
      label: 'DEV',
    },
    uat: {
      mode: 'rest',
      baseUrl: 'https://uat.example.com/workspace/v1',
      label: 'UAT',
    },
    broken: { mode: 'rest' }, // no baseUrl — must never be selected
  },
};

describe('resolveStorageEnvironment', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to local when nothing is configured', () => {
    expect(resolveStorageEnvironment(undefined, '')).toEqual(
      LOCAL_STORAGE_ENVIRONMENT,
    );
  });

  it('uses the settings defaultEnvironment when no override exists', () => {
    const env = resolveStorageEnvironment(SETTINGS, '');
    expect(env.name).toBe('dev');
    expect(env.config.baseUrl).toBe('http://localhost:3000/workspace/v1');
  });

  it('prefers the ?storageEnv= query param over everything', () => {
    saveStorageEnvironmentChoice('dev');
    const env = resolveStorageEnvironment(
      SETTINGS,
      '?env=local&storageEnv=uat',
    );
    expect(env.name).toBe('uat');
  });

  it('prefers the saved user choice over the settings default', () => {
    saveStorageEnvironmentChoice('uat');
    expect(resolveStorageEnvironment(SETTINGS, '').name).toBe('uat');
  });

  it('lets the saved choice select local explicitly', () => {
    saveStorageEnvironmentChoice('local');
    expect(resolveStorageEnvironment(SETTINGS, '').name).toBe('local');
  });

  it('skips an unknown environment name and falls through to the next candidate', () => {
    saveStorageEnvironmentChoice('nope');
    expect(
      resolveStorageEnvironment(SETTINGS, '?storageEnv=alsonope').name,
    ).toBe('dev');
  });

  it('skips a rest environment without baseUrl (bad config never bricks boot)', () => {
    const env = resolveStorageEnvironment(SETTINGS, '?storageEnv=broken');
    expect(env.name).toBe('dev'); // falls through to the settings default
  });

  it('falls back to local when every candidate is invalid', () => {
    const settings: StorageSettings = {
      defaultEnvironment: 'broken',
      environments: SETTINGS.environments,
    };
    expect(resolveStorageEnvironment(settings, '').name).toBe('local');
  });
});

describe('listStorageEnvironments', () => {
  it('always includes local first plus the configured environments', () => {
    const names = listStorageEnvironments(SETTINGS).map((e) => e.name);
    expect(names).toEqual(['local', 'dev', 'uat', 'broken']);
    expect(listStorageEnvironments(undefined).map((e) => e.name)).toEqual([
      'local',
    ]);
  });
});

describe('saved choice helpers', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips and clears the choice', () => {
    expect(getSavedStorageEnvironmentChoice()).toBeUndefined();
    saveStorageEnvironmentChoice('uat');
    expect(localStorage.getItem(STORAGE_ENV_CHOICE_KEY)).toBe('uat');
    expect(getSavedStorageEnvironmentChoice()).toBe('uat');
    saveStorageEnvironmentChoice(undefined);
    expect(getSavedStorageEnvironmentChoice()).toBeUndefined();
  });
});
