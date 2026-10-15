import { defineConfig } from 'vite';

export default defineConfig({
  // Resolve every built asset relative to the packaged HTML/CSS, including music.
  base: './',
  build: { emptyOutDir: true },
  server: {
    // Generated binaries, caches and QA profiles can contain locked Windows files.
    watch: { ignored: ['**/.tools/**', '**/.qa/**', '**/release/**', '**/Microsoft/**'] },
  },
});
