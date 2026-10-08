// Compatibility command: verify versioned illustrations instead of recreating
// the old geometric placeholders. Replace artwork through the reviewed asset workflow.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = process.argv[2] ?? resolve(root, 'public/images/portion-guides');
const names = ['palm', 'fist', 'cupped-hand', 'thumb', 'thumb-tip'];
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

for (const name of names) {
  const image = readFileSync(resolve(directory, `${name}.png`));
  if (!image.subarray(0, 8).equals(signature) || image.length < 10000) {
    throw new Error(`Invalid portion illustration: ${name}.png`);
  }
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  if (width < 500 || height < 500 || width !== height) {
    throw new Error(`Portion illustration must be a square of at least 500px: ${name}`);
  }
  console.log(`Verified ${name}.png (${width}×${height}, ${image.length} bytes)`);
}
console.log('Reviewed hand illustrations retained. No assets were overwritten.');
