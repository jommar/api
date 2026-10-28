import { LogicalSize, getCurrentWindow } from '@tauri-apps/api/window';

/** Resizes the desktop app's window; does nothing in a plain browser tab. */
export function resizeWindow(width: number, height: number): void {
  if (!('__TAURI_INTERNALS__' in window)) return;
  void getCurrentWindow()
    .setSize(new LogicalSize(width, height))
    .catch(() => {});
}
