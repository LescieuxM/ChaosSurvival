// Small Windows-style menus shared by the roster and conversation windows.
export function messengerMenu(element, groups) {
  const bar = element.querySelector('.msn-menu');
  bar.replaceChildren();
  bar.setAttribute('role', 'menubar');
  let active;
  const close = (restoreFocus = false) => {
    if (!active) return;
    active.menu.hidden = true;
    active.button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) active.button.focus();
    active = null;
  };
  const entries = groups.map(([label, actions]) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'messenger-menu-group';
    const button = document.createElement('button');
    button.textContent = label;
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.className = 'messenger-dropdown';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    for (const action of actions) {
      const item = document.createElement('button');
      item.textContent = action.label;
      item.disabled = Boolean(action.disabled);
      item.setAttribute('role', 'menuitem');
      item.addEventListener('click', () => {
        close();
        action.run();
      });
      menu.append(item);
    }
    const entry = { button, menu };
    button.addEventListener('click', () => {
      const same = active === entry;
      close();
      if (!same) {
        active = entry;
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
      }
    });
    wrapper.append(button, menu);
    bar.append(wrapper);
    return entry;
  });
  const outside = (event) => {
    if (!bar.contains(event.target)) close();
  };
  const keyboard = (event) => {
    if (!bar.contains(event.target)) return;
    const index = entries.findIndex(
      ({ button, menu }) => button === event.target || menu.contains(event.target),
    );
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      close();
      entries[
        (index + entries.length + (event.key === 'ArrowRight' ? 1 : -1)) % entries.length
      ].button.focus();
    } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const entry = entries[index];
      if (!entry) return;
      if (active !== entry) {
        close();
        active = entry;
        entry.menu.hidden = false;
        entry.button.setAttribute('aria-expanded', 'true');
      }
      const items = [...entry.menu.querySelectorAll('button:not(:disabled)')];
      if (!items.length) return;
      const current = items.indexOf(event.target);
      const next =
        current < 0
          ? event.key === 'ArrowDown'
            ? 0
            : items.length - 1
          : (current + items.length + (event.key === 'ArrowDown' ? 1 : -1)) % items.length;
      items[next].focus();
    } else if (event.key === 'Tab') close();
  };
  document.addEventListener('pointerdown', outside);
  bar.addEventListener('keydown', keyboard);
  return () => {
    close();
    document.removeEventListener('pointerdown', outside);
    bar.removeEventListener('keydown', keyboard);
  };
}
