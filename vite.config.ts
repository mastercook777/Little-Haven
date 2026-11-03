import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/Little-Haven/' : '/',
  server: { port: 5188, host: '0.0.0.0' },
  preview: { port: 5188, host: '0.0.0.0' },
  build: { target: 'es2022', rollupOptions: { input: {
    main: 'index.html',
    pioneer: 'pioneer.html'
  } } }
}));
