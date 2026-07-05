// macro-workspace is zoneless (provideZonelessChangeDetection) — use the zoneless test
// environment so tests run like production and Angular stops warning NG0914 about Zone.js.
import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});
