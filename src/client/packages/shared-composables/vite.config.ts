import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    target: "es2020",
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'SharedComposables',
      fileName: (format) => `shared-composables.${format}.js`
    },
    rollupOptions: {
      // 外部依存としてvueとcommon-libを除外
      external: ['vue', 'common-lib', /^common-lib\//],
      output: {
        globals: {
          vue: 'Vue',
          'common-lib': 'common-lib'
        }
      }
    }
  },
  resolve: {
    alias: {
      '@common-lib': path.resolve(__dirname, '../../common-lib/src'),
      'common-lib': path.resolve(__dirname, '../../common-lib/src'),
      '@shared-composables': path.resolve(__dirname, './src')
    },
  }
})
