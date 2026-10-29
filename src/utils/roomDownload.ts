/**
 * The room's code is downloaded by a small script that the build inlines into index.html (see
 * vite.config.ts), so it starts with the page and the loading bar can show real progress.
 * import() then reads the finished file from the browser's cache. In dev there is no such
 * script: there is no progress to show, and the import fetches the code itself.
 */
interface RoomLoad {
  /** Bytes received so far, and the file's full size (known at build time). */
  loaded: number;
  total: number;
  /** Settles when the download finishes or fails; it never rejects. */
  done: Promise<void>;
}

declare global {
  interface Window {
    __roomLoad?: RoomLoad;
  }
}

export const roomDownloaded = (): Promise<void> => window.__roomLoad?.done ?? Promise.resolve();

/** How much of the room's code has arrived (0–1), or null when it isn't being tracked. */
export function roomDownloadFraction(): number | null {
  const load = window.__roomLoad;
  return load && load.total > 0 ? Math.min(1, load.loaded / load.total) : null;
}
