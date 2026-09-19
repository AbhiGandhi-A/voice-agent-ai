export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'Camera permission was denied. Allow camera access in the browser and try again.';
    if (error.name === 'NotFoundError') return 'No camera device was found.';
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return 'The camera is unavailable or already in use.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Camera access is unavailable in this browser.';
}