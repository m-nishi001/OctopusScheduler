import "reflect-metadata";
import { createApp } from 'vue';
import './style.css'
import App from './App.vue';
import { Container } from './core/container/index';
import router from "./core/router";

Container.Register();

createApp(App).use(router).mount('#app');
