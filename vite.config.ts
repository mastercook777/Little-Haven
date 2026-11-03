import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/Little-Haven/' : '/',
  server: { port: 5188, host: '0.0.0.0' },
  preview: { port: 5188, host: '0.0.0.0' },
  build: { target: 'es2022', rollupOptions: { input: {
    main: fileURLToPath(new URL('./index.html', import.meta.url)),
    pioneer: fileURLToPath(new URL('./pioneer.html', import.meta.url))
  } } }
}));
