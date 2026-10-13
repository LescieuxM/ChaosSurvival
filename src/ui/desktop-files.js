import { bindFileActivation } from '../utils/activation.js';
import { icon } from './icons.js';

export class DesktopFiles {
  constructor(desktop, progression, onOpen, onLayout) {
    Object.assign(this, { desktop, progression, onOpen, onLayout });
  }
  render() {
    let files = this.desktop.querySelector('#desktop-files');
    if (!files) {
      files = document.createElement('nav');
      files.id = 'desktop-files';
      files.className = 'desktop-files';
      files.setAttribute('aria-label', 'Fichiers reçus');
      this.desktop.append(files);
    }
    files.replaceChildren();
    const received = new Map(
      Object.values(this.progression.data.files)
        .filter((file) => file.status === 'complete' && file.direction === 'receive')
        .map((file) => [file.id, file]),
    );
    for (const file of received.values()) {
      const button = document.createElement('button');
      button.className = 'desktop-file';
      button.dataset.fileId = file.id;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = icon('download');
      const name = document.createElement('span');
      name.textContent = file.name;
      button.append(name);
      bindFileActivation(button, () => this.onOpen(file));
      files.append(button);
    }
    this.onLayout();
  }
}
