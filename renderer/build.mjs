import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

const rendererDirectory=dirname(fileURLToPath(import.meta.url));

export async function buildRenderer({
  dependencyDirectory=rendererDirectory,
  outfile=resolve(rendererDirectory,'../renderer.js'),
  licenseFile=resolve(rendererDirectory,'../THIRD_PARTY_LICENSES.txt')
}={}) {
  const require=createRequire(resolve(dependencyDirectory,'package.json'));
  const { build }=await import(pathToFileURL(require.resolve('esbuild')).href);
  await build({
    entryPoints:[resolve(rendererDirectory,'pack.ts')],
    bundle:true, minify:true, format:'esm', target:['es2020'],
    outfile, legalComments:'eof'
  });
  const license=await readFile(resolve(rendererDirectory,'LICENSE'),'utf8');
  await writeFile(licenseFile,`cardpack-webgl (adapted renderer source)\nhttps://github.com/2manslkh/cardpack-webgl\nRevision: d3243641b53b2679902c9263554bfdcdef4e4c3d\n\n${license}`);
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await buildRenderer();
}
