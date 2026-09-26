interface WebkitFullscreenDocument {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

/**
 * Leaves fullscreen if the page is in it, including Safari/old WebKit's
 * prefixed API (same browsers useBrowserLockdown covers). Never throws —
 * the page works the same outside fullscreen.
 */
export function exitFullscreenSafely(): void {
  const doc = document as Document & WebkitFullscreenDocument;
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
      Promise.resolve(doc.webkitExitFullscreen.call(document)).catch(() => {});
    }
  } catch {
    // Nothing to degrade to.
  }
}
