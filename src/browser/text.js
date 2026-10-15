export function foldText(text) {
  return String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
