import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
  ],
  // H5 开发环境：用 proxy 代理绕过浏览器 CORS 跨域限制
  // 微信小程序走原生网络层不受 CORS 限制，生产环境无需此配置
  server: {
    proxy: {
      '/api': {
        target: 'https://gcwtnunyhfap.sealosbja.site',
        changeOrigin: true,
      },
    },
  },
})
