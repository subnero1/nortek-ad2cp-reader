import { createApp } from 'vue'
import App from './App.vue'

import dayjs from 'dayjs'
import dayjsObjectSupport from 'dayjs/plugin/objectSupport'
dayjs.extend(dayjsObjectSupport)

createApp(App).mount('#app')
