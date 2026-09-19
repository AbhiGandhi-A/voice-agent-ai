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

export function captureVideoFrame(
  videoElement: HTMLVideoElement | null,
  maxWidth = 320,
  maxHeight = 240,
  quality = 0.65
): string | null {
  if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
    return null;
  }

  const canvas = document.createElement('canvas');
  let targetWidth = videoElement.videoWidth;
  let targetHeight = videoElement.videoHeight;

  if (targetWidth > maxWidth) {
    targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
    targetWidth = maxWidth;
  }
  if (targetHeight > maxHeight) {
    targetWidth = Math.round((targetWidth * maxHeight) / targetHeight);
    targetHeight = maxHeight;
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', quality);
}
