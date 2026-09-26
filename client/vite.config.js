import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, Vite (5173) reenvía la API y Socket.IO al servidor Express (3000).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
