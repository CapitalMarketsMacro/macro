/**
 * Set or remove the OpenFin Desktop Owner Settings pin (HKCU) that selects the
 * HERE Core UI (workspace) system-app version. Introduced while Workspace 24.x
 * was on the Beta channel (unpinned RVMs then launched the Stable 23.2.x browser
 * UI, hiding the v24 features); retained now that 24.x is Stable to guarantee
 * the exact UI version the platform was tested against.
 *
 *   npm run dos          -> point DesktopOwnerSettings at http://localhost:4202/local/dos.json
 *   npm run dos:restore  -> restore the previous value (or remove it if none existed)
 *
 * Restart all OpenFin processes after changing this for the RVM to re-read it.
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const KEY = 'HKCU\\Software\\OpenFin\\RVM\\Settings';
const VALUE = 'DesktopOwnerSettings';
const DOS_URL = 'http://localhost:4202/local/dos.json';
const backupFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '.dos-backup.json');

if (process.platform !== 'win32') {
  console.log('Desktop Owner Settings pinning is only available on Windows.');
  process.exit(0);
}

function queryCurrentValue() {
  try {
    const out = execFileSync('reg', ['query', KEY, '/v', VALUE], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = out.match(/DesktopOwnerSettings\s+REG_SZ\s+(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

const restore = process.argv.includes('--restore');
const current = queryCurrentValue();

if (restore) {
  const backup = existsSync(backupFile) ? JSON.parse(readFileSync(backupFile, 'utf8')) : { previous: null };
  if (backup.previous) {
    execFileSync('reg', ['add', KEY, '/f', '/v', VALUE, '/d', backup.previous]);
    console.log(`Restored ${VALUE} -> ${backup.previous}`);
  } else if (current) {
    execFileSync('reg', ['delete', KEY, '/f', '/v', VALUE]);
    console.log(`Removed ${VALUE}`);
  } else {
    console.log('Nothing to restore.');
  }
  if (existsSync(backupFile)) unlinkSync(backupFile);
} else {
  if (current === DOS_URL) {
    console.log(`${VALUE} already points at ${DOS_URL}`);
    process.exit(0);
  }
  writeFileSync(backupFile, JSON.stringify({ previous: current }, null, 2));
  execFileSync('reg', ['add', KEY, '/f', '/v', VALUE, '/d', DOS_URL]);
  console.log(`${VALUE} -> ${DOS_URL}${current ? ` (previous value backed up: ${current})` : ''}`);
  console.log('Restart all OpenFin processes for the RVM to re-read desktop owner settings.');
}
