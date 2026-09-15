import "reflect-metadata";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { Container } from "./core/container/index";
import { createRouter, createWebHistory } from "vue-router";
import jackpotGameRoutes from "./core/router/index";

Container.register();

const router = createRouter({
  history: createWebHistory(),
  routes: jackpotGameRoutes,
});

const app = createApp(App);
app.use(router);
app.mount("#app");
