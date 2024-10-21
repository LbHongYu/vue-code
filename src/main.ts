import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { mirrorWatch } from './common/mirror'

mirrorWatch.init({
  env: 'local', // 写死为 local
  systemId: 'vue-code',
  mutatedConsole: []
});

const app = createApp(App)
app.use(router)
app.mount('#app')
