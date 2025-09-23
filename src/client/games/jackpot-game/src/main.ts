import "reflect-metadata";
import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { Container } from './core/container/index';

Container.Register();

const app = createApp(App);
app.mount('#app');
