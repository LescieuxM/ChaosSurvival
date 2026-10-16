import { MAX_TEXT_BYTES, textBytes } from '../story/text-files.js';
import { messengerMenu } from './messenger-menu.js';

export function attachNotepad(instance, manager, files, path, item) {
  const { element, task, id } = instance;
  const editor = element.querySelector('.notepad-content');
  const status = element.querySelector('.window-status');
  const prompt = element.querySelector('.notepad-confirm');
  const menu = element.querySelector('.msn-menu');
  const minimize = element.querySelector('.msn-minimize');
  const setPrompt = (visible) => {
    prompt.hidden = !visible;
    editor.inert = menu.inert = visible;
    minimize.disabled = visible;
  };
  const loaded = files.read(path, item.text ?? '');
  let allowClose = false;
  editor.value = loaded.text;
  // Textareas normalize CRLF; opening an original Windows text file is not an edit.
  let saved = editor.value;
  let accepted = saved;
  editor.readOnly = loaded.readonly;
  element.dataset.filePath = path;
  const notice = loaded.readonly
    ? 'Document de plus de 100 Ko : lecture seule, contenu intégral conservé.'
    : loaded.conflict
      ? 'Le document d’origine a changé. Votre version enregistrée est conservée.'
      : '';
  const refresh = () => {
    const title = `${editor.value !== saved ? '*' : ''}${item.name} — Bloc-notes`;
    element.querySelector('.window-title > span').textContent = title;
    task.querySelector('span').textContent = title;
    task.title = title;
    status.textContent = notice || `${textBytes(editor.value)} / 102 400 octets UTF-8`;
  };
  const save = () => {
    if (editor.readOnly) return false;
    try {
      files.save(path, editor.value, item.text ?? '');
      saved = accepted = editor.value;
      refresh();
      status.textContent = 'Enregistré · Windows XD';
      return true;
    } catch (error) {
      status.textContent = error.message;
      return false;
    }
  };
  editor.addEventListener('input', () => {
    if (textBytes(editor.value) > MAX_TEXT_BYTES) {
      editor.value = accepted;
      status.textContent =
        'Windows XD : modification refusée, maximum 100 Ko (102 400 octets UTF-8).';
      return;
    }
    accepted = editor.value;
    refresh();
  });
  const finish = () => {
    allowClose = true;
    manager.close(id);
  };
  instance.onVirtualDelete = () => {
    allowClose = true;
    editor.value = saved;
    setPrompt(false);
    manager.close(id);
  };
  const answers = prompt.querySelectorAll('[data-answer]');
  for (const button of answers)
    button.addEventListener('click', () => {
      if (button.dataset.answer === 'yes') {
        if (save()) finish();
      } else if (button.dataset.answer === 'no') finish();
      else {
        setPrompt(false);
        editor.focus();
      }
    });
  prompt.querySelector('p').textContent =
    `Voulez-vous enregistrer les modifications apportées à ${item.name} ?`;
  manager.windows.get(id).beforeClose = () => {
    if (allowClose || editor.value === saved) return true;
    setPrompt(true);
    prompt.querySelector('[data-answer="cancel"]').focus();
    return false;
  };
  const disposeMenu = messengerMenu(element, [
    [
      'Fichier',
      [
        { label: 'Enregistrer', run: save, disabled: loaded.readonly },
        { label: 'Quitter', run: () => manager.close(id) },
      ],
    ],
  ]);
  const keyboard = (event) => {
    if (!event.ctrlKey || event.altKey || event.key.toLowerCase() !== 's') return;
    const visible = [...manager.windows.values()].filter(
      ({ element }) => !element.hidden && element.isConnected,
    );
    const top = visible.reduce(
      (a, b) => (Number(a.element.style.zIndex) > Number(b.element.style.zIndex) ? a : b),
      visible[0],
    );
    if (top?.element !== element || manager.field?.inert || !prompt.hidden) return;
    event.preventDefault();
    save();
  };
  document.addEventListener('keydown', keyboard);
  refresh();
  return () => {
    disposeMenu();
    document.removeEventListener('keydown', keyboard);
  };
}
