/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** 'true' turns the canvas editor on by default (see src/environments/features.ts). */
  readonly VITE_CANVAS_EDITOR?: string;
}
