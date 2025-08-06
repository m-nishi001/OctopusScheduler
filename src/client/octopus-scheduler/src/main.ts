import "reflect-metadata"; 
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from "./vue/router";

const app = createApp(App);
app.use(router);
app.mount('#app')
