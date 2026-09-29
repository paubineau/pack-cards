import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {access, mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import * as cards from 'pack-cards';
import * as appearance from 'pack-cards/appearance';
import * as presentation from 'pack-cards/presentation';
import * as materials from 'pack-cards/export-material';

const require=createRequire(import.meta.url);

test('consumer entry points preserve named and compatibility exports without a DOM', () => {
  assert.equal(cards.createPackCards, presentation.createPackCards);
  assert.equal(cards.normalizeAppearance, appearance.normalizeRecapAppearance);
  assert.equal(cards.resolveAppearance, appearance.resolveRecapAppearance);
  assert.equal(cards.createExportCard, materials.recapExportCard);
  assert.equal(cards.drawExportStock, materials.drawRecapExportStock);
  assert.equal(typeof globalThis.document, 'undefined');
});

test('consumer build tools can resolve shipped renderer, CSS assets and notices', async () => {
  const manifest=JSON.parse(await readFile(require.resolve('pack-cards/package.json'), 'utf8'));
  assert.equal(manifest.private, true);
  for (const path of ['pack-cards/renderer', 'pack-cards/styles.css',
    'pack-cards/assets/foil-grain.svg', 'pack-cards/THIRD_PARTY_LICENSES.txt']) {
    await access(require.resolve(path));
  }
  const renderer=await import('pack-cards/renderer');
  assert.equal(typeof renderer.mountPack, 'function');
});

test('a packed private package installs and resolves outside its source repository', async t => {
  const npm=process.env.npm_execpath;
  if (!npm) { t.skip('Run through npm test to exercise the npm consumer install.'); return; }
  const root=fileURLToPath(new URL('../', import.meta.url));
  const temporary=await mkdtemp(join(tmpdir(), 'pack-cards-consumer-'));
  const consumer=join(temporary, 'app');
  await mkdir(consumer);
  const run=(args, cwd) => {
    const result=spawnSync(process.execPath, args, {cwd, encoding:'utf8', timeout:60000});
    assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
    return result.stdout;
  };
  const [packed]=JSON.parse(run([npm, 'pack', '--json', '--ignore-scripts', '--pack-destination', temporary], root));
  await writeFile(join(consumer, 'package.json'), JSON.stringify({private:true, type:'module'}));
  run([npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--offline',
    join(temporary, packed.filename)], consumer);
  await writeFile(join(consumer, 'smoke.mjs'), `
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {access, readFile, readdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {createPackCards, normalizeAppearance} from 'pack-cards';
const require=createRequire(import.meta.url);
const root=dirname(require.resolve('pack-cards'));
const manifest=JSON.parse(await readFile(require.resolve('pack-cards/package.json'), 'utf8'));
assert.equal(manifest.private, true);
assert.equal(typeof createPackCards().mountCard, 'function');
assert.equal(normalizeAppearance().version, 5);
assert.equal(typeof globalThis.document, 'undefined');
for (const [key, target] of Object.entries(manifest.exports)) {
  if (key==='./assets/*') {
    for (const name of await readdir(resolve(root, 'assets'))) await access(require.resolve('pack-cards/assets/'+name));
    continue;
  }
  const name='pack-cards'+(key==='.' ? '' : key.slice(1));
  await access(require.resolve(name));
  if (target.types) await access(resolve(root, target.types));
  if (target.default?.endsWith('.js')) assert.ok(Object.keys(await import(name)).length);
}
`);
  run([join(consumer, 'smoke.mjs')], consumer);
  // Leave the small isolated installation available for inspection; never recursively delete files.
  t.diagnostic(`External consumer fixture: ${consumer}`);
});
