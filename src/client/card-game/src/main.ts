import "reflect-metadata";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { createRouter, createWebHistory } from "vue-router";
import routes from "./router";
import { registerDependencies } from "./container";

registerDependencies();

const router = createRouter({ history: createWebHistory(), routes });

createApp(App).use(router).mount("#app");
