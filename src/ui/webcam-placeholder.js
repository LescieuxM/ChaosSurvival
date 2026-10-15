// Static, reusable presentation slot. No media, permissions, focus or handlers.
export function webcamPlaceholder() {
  return `<div class="msn-webcam-placeholder" role="img" aria-label="Webcam indisponible">
    <span class="msn-webcam-icon" aria-hidden="true"></span>
    <span aria-hidden="true">Webcam indisponible</span>
  </div>`;
}
