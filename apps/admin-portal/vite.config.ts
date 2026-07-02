import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import shopConfig from '../../shop.config.json';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    __SHOP_NAME__: JSON.stringify(shopConfig.shopName),
    __SHOP_CITY__: JSON.stringify(shopConfig.shopCity),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
