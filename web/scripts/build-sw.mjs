import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
const paths = (await files('dist')).filter(p => !p.endsWith('sw.js'));
const hash = createHash('sha256');
for (const p of paths.sort()) hash.update(await readFile(p));
const shell = paths.map(p => '/' + path.relative('dist', p).replaceAll('\\', '/'));
const template = await readFile('scripts/sw-template.js', 'utf8');
await writeFile('dist/sw.js', template.replace('__CACHE__', `prioritymail-${hash.digest('hex').slice(0, 12)}`).replace('__SHELL__', JSON.stringify([...shell, '/'])));
console.log('Generated versioned offline service worker.');
