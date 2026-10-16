import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const audioPath = /\.(?:mp3|wav|ogg|m4a|aac|flac)(?:\?url)?$/i;

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(filename)));
    else if (entry.isFile() && /\.(?:js|mjs|ts|tsx)$/.test(entry.name)) files.push(filename);
  }
  return files;
}

export async function collectAudioReferences(projectRoot) {
  const root = path.resolve(projectRoot);
  const references = new Map();
  const matchers = [
    /new\s+URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*,?\s*\)/g,
    /\bfrom\s*(['"])([^'"]+)\1/g,
  ];

  for (const filename of await sourceFiles(path.join(root, 'src'))) {
    const source = await readFile(filename, 'utf8');
    for (const matcher of matchers) {
      matcher.lastIndex = 0;
      for (const match of source.matchAll(matcher)) {
        const specifier = match[2];
        if (!audioPath.test(specifier)) continue;
        const cleanSpecifier = specifier.replace(/\?url$/i, '');
        const absolute = cleanSpecifier.startsWith('/')
          ? path.resolve(root, 'public', cleanSpecifier.slice(1))
          : path.resolve(path.dirname(filename), cleanSpecifier);
        const relative = path.relative(root, absolute);
        assert.ok(
          relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
          `Audio local hors du projet : ${specifier} (${filename})`,
        );
        const key = relative.split(path.sep).join('/');
        references.set(key, absolute);
      }
    }
  }

  const result = [];
  for (const [relative, absolute] of references) {
    await readFile(absolute);
    result.push({ path: relative, absolute });
  }
  assert.ok(result.length, 'Aucune ressource audio locale référencée par src/ n’a été trouvée.');
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
