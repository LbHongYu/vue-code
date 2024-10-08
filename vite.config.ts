import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
// NOTE: 
// 如果配置文件需要基于（dev 或 build）命令或者不同的 模式 来决定选项，
// 亦或者是一个 SSR 构建（isSsrBuild）、一个正在预览的构建产物（isPreview），
// 则可以选择导出这样一个函数：
export default defineConfig(({ command, mode }) => {
  // NOTE: 
  // Vite 默认是不加载 .env 文件的，因为这些文件需要在执行完 Vite 配置后才能确定加载哪一个。
  // 当你的确需要时，你可以使用 Vite 导出的 loadEnv 函数来加载指定的 .env 文件。

  // 根据当前工作目录中的 `mode` 加载 .env 文件
  // 设置第三个参数为 '' 来加载所有环境变量，而不管是否有 `VITE_` 前缀。
  const env = loadEnv(mode, process.cwd(), '')
  console.log('command, mode, env: ', command, mode, env.VITE_SOME_KEY);
  return {
    base: '/subpath',
    plugins: [vue(), vueJsx()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  };
})
