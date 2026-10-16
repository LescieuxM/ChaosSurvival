export const MAX_TEXT_BYTES = 102400;
export const textBytes = (text) => new TextEncoder().encode(text).byteLength;

// An overlay on virtual documents, stored with the active story. Never host files.
export class VirtualTextFiles {
  constructor(progression, virtualFilesystem = null) {
    this.progression = progression;
    this.virtualFilesystem = virtualFilesystem;
  }
  key(path) {
    return String(path).replaceAll('\\', '/').toLowerCase();
  }
  isAvailable(path) {
    return !this.virtualFilesystem || this.virtualFilesystem.exists(this.key(path));
  }
  read(path, original) {
    if (!this.isAvailable(path))
      return { text: original, readonly: textBytes(original) > MAX_TEXT_BYTES, conflict: false };
    const key = this.key(path);
    const textFiles = this.progression.data.textFiles ?? {};
    const savedPath = Object.keys(textFiles).find((candidate) => this.key(candidate) === key);
    const entry = textFiles[savedPath];
    const valid =
      entry &&
      typeof entry.text === 'string' &&
      typeof entry.original === 'string' &&
      textBytes(entry.text) <= MAX_TEXT_BYTES;
    return {
      text: valid ? entry.text : original,
      readonly: textBytes(valid ? entry.text : original) > MAX_TEXT_BYTES,
      conflict: Boolean(valid && entry.original !== original),
    };
  }
  save(path, text, original) {
    if (!this.isAvailable(path))
      throw new Error('Windows XD : ce fichier a été supprimé. Enregistrement impossible.');
    if (textBytes(text) > MAX_TEXT_BYTES)
      throw new Error('Windows XD : taille maximale atteinte (100 Ko / 102 400 octets UTF-8).');
    const previous = this.progression.data.textFiles;
    const key = this.key(path);
    const next = { ...previous };
    for (const candidate of Object.keys(next))
      if (this.key(candidate) === key) delete next[candidate];
    this.progression.data.textFiles = {
      ...next,
      [key]: { text, original },
    };
    if (!this.progression.save()) {
      this.progression.data.textFiles = previous;
      throw new Error(
        'Windows XD : enregistrement impossible. Vos modifications restent ouvertes.',
      );
    }
  }
}
