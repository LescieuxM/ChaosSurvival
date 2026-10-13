import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFile as readArchiveFile, listPackage, statFile } from '@electron/asar';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const projectPackage = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
export const buildDirectory = path.resolve(projectRoot, projectPackage.build.directories.output);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const archivePath = (filename) => filename.replaceAll('\\', '/').replace(/^\//, '');
const extractFile = (archive, filename) => readArchiveFile(archive, path.normalize(filename));

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    assert.ok(
      !entry.isSymbolicLink(),
      `Une ressource ne doit pas dépendre d’un lien : ${filename}`,
    );
    if (entry.isDirectory()) files.push(...(await walk(filename)));
    else if (entry.isFile()) files.push(filename);
  }
  return files;
}

export async function verifyArchive(
  archive = path.join(buildDirectory, 'win-unpacked/resources/app.asar'),
) {
  const files = new Set(listPackage(archive).map(archivePath));
  const expected = [
    ...(await walk(path.join(projectRoot, 'dist'))),
    ...(await walk(path.join(projectRoot, 'electron'))),
  ];
  const verified = [];

  for (const filename of expected) {
    const relative = archivePath(path.relative(projectRoot, filename));
    assert.ok(files.has(relative), `Ressource absente de l’archive : ${relative}`);
    assert.ok(
      !statFile(archive, path.normalize(relative)).unpacked,
      `Ressource extérieure à l’archive : ${relative}`,
    );
    const original = await readFile(filename);
    const embedded = extractFile(archive, relative);
    const sha256 = digest(original);
    assert.equal(digest(embedded), sha256, `Ressource altérée : ${relative}`);
    verified.push({ path: relative, bytes: original.length, sha256 });

    if (/\.(?:js|cjs|html|css)$/.test(relative)) {
      const text = embedded.toString('utf8').replaceAll('\\', '/').toLowerCase();
      assert.ok(
        !text.includes(projectRoot.replaceAll('\\', '/').toLowerCase()),
        `Chemin absolu du projet dans ${relative}`,
      );
    }
  }

  for (const publicFile of await walk(path.join(projectRoot, 'public'))) {
    const relative = archivePath(path.relative(path.join(projectRoot, 'public'), publicFile));
    assert.equal(
      digest(extractFile(archive, `dist/${relative}`)),
      digest(await readFile(publicFile)),
      `Ressource publique absente ou altérée : ${relative}`,
    );
  }

  const music = verified.filter(
    (file) => file.path.startsWith('dist/') && file.path.endsWith('.mp3'),
  );
  assert.equal(music.length, 1, 'La musique doit être intégrée à l’archive');
  assert.equal(
    music[0].sha256,
    digest(await readFile(path.join(projectRoot, 'assets/musiclvl1.mp3'))),
    'La musique intégrée doit correspondre au MP3 original',
  );
  assert.ok(
    ![...files].some((file) => file.endsWith('.wav')),
    'L’ancienne musique WAV ne doit pas être embarquée',
  );
  assert.ok(
    verified.some((file) => /^dist\/assets\/.*\.js$/.test(file.path)),
    'JavaScript du jeu absent',
  );
  assert.ok(
    verified.some((file) => /^dist\/assets\/.*\.css$/.test(file.path)),
    'Styles du jeu absents',
  );
  assert.ok(files.has('dist/index.html'), 'Page du jeu absente');

  const packaged = JSON.parse(extractFile(archive, 'package.json').toString('utf8'));
  const source = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.equal(packaged.main, source.main, 'Point d’entrée Electron incorrect');
  assert.equal(packaged.version, source.version, 'Version empaquetée incorrecte');
  assert.ok(files.has(packaged.main), 'Point d’entrée Electron absent de l’archive');

  return { archive, version: packaged.version, files: verified, music: music[0] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyArchive(process.argv[2]);
  console.log(`OK : ${result.files.length} ressources intégrées et vérifiées par SHA-256.`);
  console.log(`OK : musique originale intégrée (${result.music.bytes} octets).`);
  console.log(
    'OK : HTML, CSS, JavaScript et Electron inclus ; aucun chemin absolu vers le projet.',
  );
}
