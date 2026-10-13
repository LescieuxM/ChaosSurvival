// Geometry is centered in each viewBox, independently of system font metrics.
const faces = [
  {
    viewBox: '0 0 48 48',
    body: '<circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="17" cy="18" r="2.5"/><circle cx="31" cy="18" r="2.5"/><path d="M14 27 Q24 40 34 27" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  },
  {
    viewBox: '0 0 48 48',
    body: '<circle cx="24" cy="24" r="21.5"/><g fill="#ffe85c"><circle cx="17" cy="18" r="2.5"/><circle cx="31" cy="18" r="2.5"/></g><path d="M14 27 Q24 40 34 27" fill="none" stroke="#ffe85c" stroke-width="3" stroke-linecap="round"/>',
  },
  {
    viewBox: '0 4 48 38',
    body: '<path d="M24 42 L8 26 Q0 18 4 10 Q12 -2 24 10 Q36 -2 44 10 Q48 18 40 26 Z"/>',
  },
  {
    viewBox: '2 2 44 42',
    body: '<path d="M24 2 L30 17 L46 18 L34 29 L38 44 L24 35 L10 44 L14 29 L2 18 L18 17 Z"/>',
  },
];

export function smileyIcon(variant) {
  const { viewBox, body } = faces[variant];
  return `<svg class="catch-smiley-icon" viewBox="${viewBox}" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;
}
