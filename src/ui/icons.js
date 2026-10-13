const paths = {
  computer:
    '<rect x="5" y="3" width="36" height="27" rx="3" fill="#dce5eb" stroke="#536774" stroke-width="2"/><path d="M10 8h26v16H10z" fill="#0e7bcc"/><path d="m13 21 7-9 7 6 6-7v10" fill="#6ce5fc"/><path d="M20 31h8v5h-8z" fill="#919ca7"/><path d="M10 37h28l5 7H5z" fill="#e7e6dc" stroke="#69757c"/>',
  folder:
    '<path d="M3 11h16l5 5h20v26H3z" fill="#da9c19" stroke="#946400"/><path d="M3 19h42l-5 24H6z" fill="#ffda6a" stroke="#c18e17"/><path d="M7 23h32" stroke="#fff3ad" stroke-width="3"/>',
  msn: '<circle cx="30" cy="10" r="7" fill="#59a3ed" stroke="#2378b8"/><path d="M20 36V26c0-12 22-12 22 0v10z" fill="#77bafa" stroke="#287cbd"/><circle cx="17" cy="17" r="8" fill="#96d943" stroke="#50972d"/><path d="M4 44V33c0-14 26-14 26 0v11z" fill="#a0e156" stroke="#50972d"/><path d="M9 33c0-7 6-9 11-7" fill="none" stroke="#e4ffa8" stroke-width="3"/>',
  bin: '<path d="m12 12 3 32h21l3-32" fill="#d3ebf0" fill-opacity=".85" stroke="#63899c" stroke-width="2"/><ellipse cx="25" cy="12" rx="14" ry="5" fill="#f6fcff" stroke="#63899c"/><path d="m19 24 5-6 6 6m-6-6v16m-7-1 7 4 7-4" fill="none" stroke="#47aa60" stroke-width="3"/>',
  music:
    '<path d="M20 11v25M20 12l21-5v24M20 19l21-5" stroke="#5a39b6" stroke-width="5"/><ellipse cx="14" cy="37" rx="8" ry="6" fill="#9d72ef" stroke="#5a39b6"/><ellipse cx="35" cy="32" rx="8" ry="6" fill="#9d72ef" stroke="#5a39b6"/>',
  error:
    '<circle cx="24" cy="24" r="19" fill="#ec4640" stroke="#ab251b" stroke-width="2"/><path d="m16 16 16 16m0-16L16 32" stroke="white" stroke-width="5"/>',
  shield:
    '<path d="M24 3 42 10v13c0 11-10 19-18 23C16 42 6 34 6 23V10z" fill="#f4c74f" stroke="#967018" stroke-width="2"/><path d="M24 8v31c6-4 13-10 13-17V14z" fill="#ef9737"/><path d="M24 15v12m0 5v3" stroke="#7b4318" stroke-width="4"/>',
  download:
    '<path d="M6 29h36v15H6z" fill="#dce7ed" stroke="#5f798b" stroke-width="2"/><path d="M9 34h30v6H9z" fill="#91adc1"/><path d="M18 4h12v17h8L24 34 10 21h8z" fill="#7ccb47" stroke="#41812c" stroke-width="2"/><path d="M21 7v16" stroke="#d7f59c" stroke-width="3"/>',
  globe:
    '<circle cx="24" cy="24" r="20" fill="#45baff" stroke="#2c74ba"/><path d="m8 12 10-5 7 6-5 8 3 6-5 8-5-8-7-5m28-7 8 4-4 12-8 6-3-10" fill="#81d250"/><ellipse cx="24" cy="24" rx="12" ry="20" fill="none" stroke="#daf4ff" opacity=".5"/><path d="M5 24h38" stroke="#daf4ff" opacity=".5"/>',
  help: '<circle cx="24" cy="24" r="20" fill="#58a8ee" stroke="#1b63b7"/><path d="M17 16c0-9 18-9 16 1-1 5-9 5-9 12m0 5v3" fill="none" stroke="white" stroke-width="4"/>',
  flag: '<path d="m4 8 17-4v17H4z" fill="#f74f36"/><path d="m25 4 17 4v13H25z" fill="#80c83d"/><path d="M4 25h17v18L4 39z" fill="#49a9fa"/><path d="M25 25h17v14l-17 4z" fill="#ffcf44"/>',
};
export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 48 48" aria-hidden="true">${paths[name] ?? paths.computer}</svg>`;
}
