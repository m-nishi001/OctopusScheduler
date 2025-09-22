import "reflect-metadata";
import { createApp } from 'vue';
import './style.css'
import App from './App.vue';
import { Container } from './core/container/index';
import router from "./core/router";
import { EventPollingService } from './model/applications/event-polling-service';

Container.Register();

const app = createApp(App);
const eventPollingService = new EventPollingService();
app.provide('eventPollingService', eventPollingService);
app.use(router).mount('#app');
