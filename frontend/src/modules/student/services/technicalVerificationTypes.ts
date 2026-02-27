// También añadir el tipo de declaración global para Window
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export {};
