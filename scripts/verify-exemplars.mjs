import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = mkdtempSync(join(tmpdir(), 'tgfwa-verify-'));
const outfile = join(outDir, 'verify.mjs');

await build({
  entryPoints: ['scripts/verify-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
});

await import(pathToFileURL(outfile).href);
