// Single-click selection and drag suppression belong to the desktop icon controller.
export function bindFileActivation(button, activate) {
  button.addEventListener('dblclick', activate);
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    activate();
  });
}
