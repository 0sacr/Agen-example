/**
 * main.ts — Vue 3 应用入口
 *
 * 创建 Vue 应用实例，挂载到 #app 节点
 * 整个应用只有一个组件：App.vue（内嵌 ChatBox.vue）
 */
import { createApp } from 'vue';
import App from './App.vue';

const app = createApp(App);
app.mount('#app');
