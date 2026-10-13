import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot, buildDirectory, verifyArchive } from './verify-package.mjs';

const result = await verifyArchive();
const executable = path.join(buildDirectory, 'ChaosSurvival.exe');
const destination = path.join(projectRoot, 'release/ChaosSurvival.exe');
await mkdir(path.dirname(destination), { recursive: true });
await copyFile(executable, destination);
assert.deepEqual(
  await readFile(destination),
  await readFile(executable),
  'Copie du portable altérée',
);
console.log(`OK : ${result.files.length} ressources vérifiées, musique originale intégrée.`);
console.log(`Portable prêt à partager : ${destination}`);
