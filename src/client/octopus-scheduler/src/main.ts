import "reflect-metadata";
import { createApp } from 'vue';
import './style.css'
import App from './App.vue';
import router from './ui/router';
import { Container } from './core/container/index';

Container.Register();

createApp(App).use(router).mount('#app');
