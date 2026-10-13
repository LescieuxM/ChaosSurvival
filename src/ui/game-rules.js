export function validateGameRules(definition) {
  const rules = definition.rules;
  if (!rules) return;
  if (
    !['id', 'title', 'description'].every(
      (key) => typeof rules[key] === 'string' && rules[key].trim(),
    ) ||
    !['controls', 'mechanics'].every(
      (key) => Array.isArray(rules[key]) && rules[key].every((text) => typeof text === 'string'),
    )
  )
    throw new Error('Définition des règles invalide.');
}

export class GameRules {
  constructor(desktop, progression) {
    Object.assign(this, { desktop, progression });
  }
  get active() {
    return Boolean(this.layer);
  }
  hasSeen(definition) {
    const id = definition.rules?.id;
    if (!id) return true;
    if (this.progression.data.tutorials?.[id] === true) return true;
    // Older saves had no tutorial record. Completed games remain replayable directly.
    return this.progression.story.sequences.some(
      (sequence) =>
        (sequence.id === id || sequence.game === id) &&
        this.progression.data.completed.includes(sequence.id),
    );
  }
  beforeStart(definition, start, cancel = () => {}) {
    if (this.active) return;
    if (this.hasSeen(definition)) return start();
    this.show(definition, start, cancel);
  }
  review(definition, resume = () => {}) {
    if (!this.active) this.show(definition, resume, resume, false);
  }
  show(definition, confirm, cancel, first = true) {
    const rules = definition.rules;
    if (!rules) return confirm();
    const layer = document.createElement('div');
    layer.className = 'rules-layer';
    layer.innerHTML = `<section class="xp-window rules-window" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <header class="titlebar"><span class="window-title">★ Mode d’emploi</span><button class="close-button rules-cancel" aria-label="Fermer les règles">×</button></header>
      <div class="rules-content"><small class="rules-edition">READY, SET, PLAY !</small><h2 id="rules-title"></h2><p class="rules-description"></p><img class="rules-illustration" alt="" hidden />
      <h3>LES COMMANDES</h3><ul class="rules-controls"></ul><h3>COMMENT GAGNER</h3><ul class="rules-mechanics"></ul>
      <button class="start-button rules-confirm"></button></div>
    </section>`;
    layer.querySelector('#rules-title').textContent = rules.title;
    layer.querySelector('.rules-description').textContent = rules.description;
    for (const [selector, lines] of [
      ['.rules-controls', rules.controls],
      ['.rules-mechanics', rules.mechanics],
    ]) {
      for (const text of lines ?? []) {
        const item = document.createElement('li');
        item.textContent = text;
        layer.querySelector(selector).append(item);
      }
    }
    if (/^\.\/(?:covers|icons|logos)\/[a-z0-9-]+\.svg$/.test(rules.illustration ?? '')) {
      const image = layer.querySelector('.rules-illustration');
      image.src = rules.illustration;
      image.hidden = false;
    }
    const button = layer.querySelector('.rules-confirm');
    button.textContent = first ? "C'EST PARTI !" : 'RETOUR AU JEU';
    this.background = [...this.desktop.children].map((element) => [element, element.inert]);
    for (const [element] of this.background) element.inert = true;
    this.layer = layer;
    this.desktop.append(layer);
    const close = (accepted) => {
      if (this.layer !== layer) return;
      this.hide();
      if (accepted) {
        this.progression.data.tutorials ??= {};
        this.progression.data.tutorials[rules.id] = true;
        this.progression.save();
      }
      (accepted ? confirm : cancel)();
    };
    button.addEventListener('click', () => close(true));
    layer.querySelector('.rules-cancel').addEventListener('click', () => close(false));
    layer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(false);
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        const target =
          document.activeElement === button ? layer.querySelector('.rules-cancel') : button;
        target.focus();
      }
    });
    button.focus();
  }
  hide() {
    this.layer?.remove();
    this.layer = null;
    for (const [element, inert] of this.background ?? []) element.inert = inert;
    this.background = null;
  }
}
