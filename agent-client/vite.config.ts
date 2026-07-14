import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // ★ 代理配置：将 /chat /health /clear 请求转发到后端 3001 端口
    // 避免前端直接跨域请求，也保护了 API Key（不暴露在前端代码中）
    proxy: {
      '/chat': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/clear': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
