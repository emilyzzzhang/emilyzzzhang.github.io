import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Downloads the room's chunk from an inline script at the top of the page, so it starts at once
 * instead of after the app shell has loaded and run, and counts its bytes for the loading bar
 * (src/utils/roomDownload.ts). The chunk's size is written in at build time, which is what makes
 * the bar exact: a gzipped response's Content-Length is the compressed size, not what the stream
 * yields. Only a fetch is used, never a second <link> preload, so the file is downloaded once.
 */
function trackRoomDownload(): Plugin {
  return {
    name: 'track-room-download',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        if (!bundle) return;
        const chunks = Object.values(bundle);
        const scene = chunks.find((c) => c.type === 'chunk' && c.facadeModuleId?.endsWith('/components/3d/RoomScene.tsx'));
        if (!scene || scene.type !== 'chunk') return;
        const url = JSON.stringify(`/${scene.fileName}`);
        const total = new TextEncoder().encode(scene.code).length;
        const script = `(function () {
  if (!window.fetch || !window.ReadableStream) return;
  var load = (window.__roomLoad = { loaded: 0, total: ${total} });
  load.done = fetch(${url})
    .then(function (res) {
      if (!res.ok || !res.body) return;
      var reader = res.body.getReader();
      var pump = function () {
        return reader.read().then(function (r) {
          if (r.done) return;
          load.loaded += r.value.length;
          return pump();
        });
      };
      return pump();
    })
    .catch(function () {});
})();`;
        const tags: { tag: string; attrs?: Record<string, string>; children?: string; injectTo: 'head' | 'head-prepend' }[] = [
          { tag: 'script', children: script, injectTo: 'head-prepend' },
        ];
        // The loading screen's sky is only referenced from CSS, so the browser would find it late.
        const sky = chunks.find((c) => c.type === 'asset' && /^assets\/sky-day-.*\.jpg$/.test(c.fileName));
        if (sky) tags.push({ tag: 'link', attrs: { rel: 'preload', as: 'image', href: `/${sky.fileName}` }, injectTo: 'head' });
        return tags;
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), trackRoomDownload()],
  build: {
    // three.js lives in the lazily-loaded scene chunk; it is large by nature.
    chunkSizeWarningLimit: 1400,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
