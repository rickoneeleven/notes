import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'public',
  publicDir: '../static_server_files',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html')
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'https://notes.pinescore.com',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            const cookies = proxyRes.headers['set-cookie'];
            if (cookies) {
              proxyRes.headers['set-cookie'] = cookies.map(cookie => 
                cookie.replace(/Domain=[^;]+;?/gi, '')
                      .replace(/Secure;?/gi, '')
              );
            }
          });
        }
      },
      '/note.php': {
        target: 'https://notes.pinescore.com',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
