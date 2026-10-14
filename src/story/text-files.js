export const MAX_TEXT_BYTES = 102400;
export const textBytes = (text) => new TextEncoder().encode(text).byteLength;

// An overlay on virtual documents, stored with the active story. Never host files.
export class VirtualTextFiles {
  constructor(progression) {
    this.progression = progression;
  }
  read(path, original) {
    const entry = this.progression.data.textFiles?.[path];
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
    if (textBytes(text) > MAX_TEXT_BYTES)
      throw new Error('Windows XD : taille maximale atteinte (100 Ko / 102 400 octets UTF-8).');
    const previous = this.progression.data.textFiles;
    this.progression.data.textFiles = {
      ...previous,
      [path]: { text, original },
    };
    if (!this.progression.save()) {
      this.progression.data.textFiles = previous;
      throw new Error(
        'Windows XD : enregistrement impossible. Vos modifications restent ouvertes.',
      );
    }
  }
}
