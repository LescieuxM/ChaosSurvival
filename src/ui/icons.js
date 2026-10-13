import { brandIcons, applicationLogo } from './identity.js';
const paths = {
  computer:
    '<rect x="5" y="3" width="36" height="27" rx="3" fill="#dce5eb" stroke="#536774" stroke-width="2"/><path d="M10 8h26v16H10z" fill="#0e7bcc"/><path d="m13 21 7-9 7 6 6-7v10" fill="#6ce5fc"/><path d="M20 31h8v5h-8z" fill="#919ca7"/><path d="M10 37h28l5 7H5z" fill="#e7e6dc" stroke="#69757c"/>',
  folder:
    '<path d="M3 11h16l5 5h20v26H3z" fill="#da9c19" stroke="#946400"/><path d="M3 19h42l-5 24H6z" fill="#ffda6a" stroke="#c18e17"/><path d="M7 23h32" stroke="#fff3ad" stroke-width="3"/>',
  bin: '<path d="m12 12 3 32h21l3-32" fill="#d3ebf0" fill-opacity=".85" stroke="#63899c" stroke-width="2"/><ellipse cx="25" cy="12" rx="14" ry="5" fill="#f6fcff" stroke="#63899c"/><path d="m19 24 5-6 6 6m-6-6v16m-7-1 7 4 7-4" fill="none" stroke="#47aa60" stroke-width="3"/>',
  error:
    '<circle cx="24" cy="24" r="19" fill="#ec4640" stroke="#ab251b" stroke-width="2"/><path d="m16 16 16 16m0-16L16 32" stroke="white" stroke-width="5"/>',
  shield:
    '<path d="M24 3 42 10v13c0 11-10 19-18 23C16 42 6 34 6 23V10z" fill="#f4c74f" stroke="#967018" stroke-width="2"/><path d="M24 8v31c6-4 13-10 13-17V14z" fill="#ef9737"/><path d="M24 15v12m0 5v3" stroke="#7b4318" stroke-width="4"/>',
  download:
    '<path d="M6 29h36v15H6z" fill="#dce7ed" stroke="#5f798b" stroke-width="2"/><path d="M9 34h30v6H9z" fill="#91adc1"/><path d="M18 4h12v17h8L24 34 10 21h8z" fill="#7ccb47" stroke="#41812c" stroke-width="2"/><path d="M21 7v16" stroke="#d7f59c" stroke-width="3"/>',
  help: '<circle cx="24" cy="24" r="20" fill="#58a8ee" stroke="#1b63b7"/><path d="M17 16c0-9 18-9 16 1-1 5-9 5-9 12m0 5v3" fill="none" stroke="white" stroke-width="4"/>',
};
export function icon(name, className = '') {
  if (brandIcons[name])
    return `<img class="icon ${className}" src="${applicationLogo(brandIcons[name])}" alt="" aria-hidden="true" draggable="false" />`;
  return `<svg class="icon ${className}" viewBox="0 0 48 48" aria-hidden="true">${paths[name] ?? paths.computer}</svg>`;
}
