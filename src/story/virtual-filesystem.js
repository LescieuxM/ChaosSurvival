import fileDefinitions from '../config/filesystem.json' with { type: 'json' };
import appDefinitions from '../config/desktop-apps.json' with { type: 'json' };

const locations = Object.freeze({ ...fileDefinitions, ...appDefinitions });
const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);
const keyPattern = /^([a-z0-9-]+)\/([^/\\]+)$/i;
const safeName = (name) =>
  typeof name === 'string' &&
  name.length > 0 &&
  name.length <= 160 &&
  name !== '.' &&
  name !== '..' &&
  !/[\\/\u0000-\u001f]/.test(name);
const protectedImageNames = new Set(['fond-bureau.jpg', 'fond_bureau.jpg', 'fond-ecran.jpg']);
const isDeletableFile = (file) => {
  const name = String(file?.name ?? '').toLowerCase();
  if (protectedImageNames.has(name)) return false;
  return file?.deletable === true || /\.(txt|jpg)$/.test(name) ||
    name === 'pixelsans.ttf' || name === 'smiley_pack_2009.zip';
};

export function virtualFileId(locationId, name) {
  return `${String(locationId).toLowerCase()}/${String(name).toLowerCase()}`;
}

function staticFiles() {
  const files = new Map();
  for (const [locationId, location] of Object.entries(locations))
    for (const item of location.items ?? [])
      if (!item.location && safeName(item.name))
        files.set(virtualFileId(locationId, item.name), { ...item, locationId });
  return files;
}

function receivedFiles(files = {}) {
  const received = new Map();
  for (const file of Object.values(files)) {
    if (
      file?.status !== 'complete' || file.direction !== 'receive' || !safeName(file.name)
    ) continue;
    const fileId = virtualFileId('downloads', file.name);
    if (received.has(fileId)) continue;
    received.set(fileId, {
      ...file,
      fileId,
      locationId: 'downloads',
      icon: 'document',
      detail: file.description ?? 'Fichier reçu',
      text: file.description ?? '',
      deletable: true,
      receivedFile: true,
    });
  }
  return received;
}

function normalizeAdded(added) {
  if (!added || typeof added !== 'object' || Array.isArray(added)) return {};
  const valid = {};
  const staticIds = new Set(staticFiles().keys());
  for (const [key, file] of Object.entries(added)) {
    const match = keyPattern.exec(key);
    if (
      !match || key.toLowerCase() === 'user-desktop/a_faire.txt' ||
      unsafeKeys.has(match[1]) || match[1] === 'bin' ||
      !Object.hasOwn(locations, match[1]) ||
      !Array.isArray(locations[match[1]].items) || !safeName(match[2]) ||
      virtualFileId(match[1], match[2]) !== key.toLowerCase() || staticIds.has(key.toLowerCase()) ||
      !file || typeof file !== 'object' || Array.isArray(file) ||
      typeof file.name !== 'string' || file.name.toLowerCase() !== match[2].toLowerCase() ||
      typeof file.detail !== 'string' || typeof file.icon !== 'string'
    ) continue;
    const normalized = {
      name: file.name,
      detail: file.detail.slice(0, 200),
      icon: /^[a-z0-9-]{1,40}$/i.test(file.icon) ? file.icon : 'document',
      deletable: file.deletable === true,
    };
    if (Number.isFinite(file.size) && file.size >= 0 && file.size <= 2 ** 31)
      normalized.size = Math.floor(file.size);
    if (typeof file.text === 'string' && file.text.length <= 102400) normalized.text = file.text;
    if (typeof file.image === 'string' && /^\.\/(?:wallpaper\.svg|covers\/[a-z0-9-]+\.svg)$/i.test(file.image))
      normalized.image = file.image;
    valid[key.toLowerCase()] = normalized;
  }
  return valid;
}

export function normalizeVirtualFilesystemState(state, files = {}) {
  const added = normalizeAdded(state?.added);
  const received = receivedFiles(files);
  const knownDeletable = new Set([
    ...[...staticFiles()].filter(([, file]) => isDeletableFile(file)).map(([key]) => key),
    ...Object.entries(added).filter(([, file]) => isDeletableFile(file)).map(([key]) => key),
    ...received.keys(),
  ]);
  const aliases = new Map([['user-desktop/a_faire.txt', 'folder/a_faire.txt']]);
  const deleted = Array.isArray(state?.deleted)
    ? [...new Set(state.deleted
        .filter((key) => typeof key === 'string')
        .map((key) => aliases.get(key.toLowerCase()) ?? key.toLowerCase())
        .filter((key) => knownDeletable.has(key)))]
    : [];
  return { deleted, added };
}

function defaultSize(item) {
  if (Number.isFinite(item.size)) return Math.floor(item.size);
  const extension = item.name.split('.').at(-1).toLowerCase();
  return ({ txt: 2048, jpg: 262144, zip: 1048576, exe: 393216 }[extension] ?? 8192);
}

export class VirtualFilesystem {
  constructor(progression) {
    this.progression = progression;
    progression.data.virtualFilesystem = normalizeVirtualFilesystemState(
      progression.data.virtualFilesystem,
      progression.data.files,
    );
  }
  get state() {
    return this.progression.data.virtualFilesystem;
  }
  getLocation(id) {
    const base = locations[id];
    if (!base || unsafeKeys.has(id)) throw new Error('Emplacement fictif inconnu.');
    const deleted = new Set(this.state.deleted);
    const items = (base.items ?? [])
      .map((item) => {
        if (item.location) return { ...item };
        return { ...item, fileId: virtualFileId(id, item.name) };
      })
      .filter((item) => item.location || !deleted.has(item.fileId));
    const present = new Set(items.filter((item) => item.fileId).map((item) => item.fileId));
    for (const [fileId, file] of Object.entries(this.state.added))
      if (fileId.startsWith(`${id.toLowerCase()}/`) && !deleted.has(fileId) && !present.has(fileId)) {
        items.push({ ...file, fileId });
        present.add(fileId);
      }
    if (id === 'downloads')
      for (const [fileId, file] of receivedFiles(this.progression.data.files))
        if (!deleted.has(fileId) && !present.has(fileId)) items.push(file);
    return { ...base, id, items };
  }
  getFile(fileId) {
    if (typeof fileId !== 'string') return null;
    const key = fileId.toLowerCase();
    if (this.state.deleted.includes(key)) return null;
    const added = this.state.added[key];
    const file = added ?? staticFiles().get(key) ?? receivedFiles(this.progression.data.files).get(key);
    return file ? { ...file, fileId: key, deletable: isDeletableFile(file) } : null;
  }
  exists(fileId) {
    return Boolean(this.getFile(fileId));
  }
  canDelete(fileId) {
    return isDeletableFile(this.getFile(fileId));
  }
  metadata(fileId) {
    const file = this.getFile(fileId);
    if (!file) return null;
    const location = locations[file.locationId ?? fileId.slice(0, fileId.indexOf('/'))];
    return {
      name: file.name,
      type: file.detail,
      location: location?.address ?? '',
      size: defaultSize(file),
      path: `${location?.address?.replace(/\\$/, '') ?? ''}\\${file.name}`,
    };
  }
  addFile(locationId, file) {
    const key = virtualFileId(locationId, file?.name);
    const match = keyPattern.exec(key);
    const location = locations[locationId];
    if (
      !match || !location || locationId === 'bin' ||
      !Array.isArray(location.items) || unsafeKeys.has(locationId) ||
      !safeName(file?.name) || staticFiles().has(key) || this.state.added[key] ||
      typeof file.detail !== 'string' || !file.detail.trim()
    ) return { ok: false, reason: 'invalid' };
    const normalized = normalizeAdded({ [key]: {
      ...file,
      icon: file.icon ?? 'document',
    } })[key];
    if (!normalized) return { ok: false, reason: 'invalid' };
    const previous = this.state;
    this.progression.data.virtualFilesystem = {
      deleted: previous.deleted.filter((id) => id !== key),
      added: { ...previous.added, [key]: normalized },
    };
    if (!this.progression.save()) {
      this.progression.data.virtualFilesystem = previous;
      return { ok: false, reason: 'save' };
    }
    return { ok: true, fileId: key };
  }
  deleteFile(fileId) {
    const key = typeof fileId === 'string' ? fileId.toLowerCase() : fileId;
    const file = this.getFile(key);
    if (!file) return { ok: false, reason: 'missing' };
    if (!this.canDelete(key)) return { ok: false, reason: 'protected' };
    const previousState = this.state;
    const previousTextFiles = this.progression.data.textFiles;
    const added = { ...previousState.added };
    delete added[key];
    this.progression.data.virtualFilesystem = {
      deleted: [...new Set([...previousState.deleted, key])],
      added,
    };
    if (previousTextFiles && typeof previousTextFiles === 'object') {
      const textFiles = { ...previousTextFiles };
      for (const key of Object.keys(textFiles))
        if (key.replaceAll('\\', '/').toLowerCase() === file.fileId) delete textFiles[key];
      this.progression.data.textFiles = textFiles;
    }
    if (!this.progression.save()) {
      this.progression.data.virtualFilesystem = previousState;
      this.progression.data.textFiles = previousTextFiles;
      return { ok: false, reason: 'save' };
    }
    return { ok: true };
  }
}
