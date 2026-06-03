import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.PORT || env.VITE_API_PORT || '3000';
  const apiTarget = `http://localhost:${apiPort}`;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
              if (id.includes('xlsx')) return 'excel';
              if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) return 'vendor';
              if (id.includes('motion')) return 'motion';
              if (id.includes('blockly')) return 'blockly';
              if (id.includes('@supabase')) return 'supabase';
              if (id.includes('lucide-react')) return 'icons';
              return;
            }
            if (id.includes('/src/views/TeacherHub') || id.includes('/src/components/teacher/')) return 'teacher';
            if (id.includes('/src/views/AdminDashboard') || id.includes('/src/components/admin/')) return 'admin';
            if (id.includes('/src/views/PrincipalDashboard')) return 'principal';
            if (id.includes('/src/challenges/') || id.includes('/src/components/arduino-ide/')) return 'challenges';
            if (id.includes('/src/views/GalaxyMap') || id.includes('/src/views/MissionPlayer')) return 'galaxy';
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          timeout: 60000,
        },
      },
    },
  };
});
