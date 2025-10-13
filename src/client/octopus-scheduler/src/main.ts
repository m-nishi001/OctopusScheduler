import "reflect-metadata";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { Container } from "./core/container/index";
import router from "./core/router";
import { registerEventHandlers } from "./ui/components/schedule-event-handler/register-event-handlers";

Container.Register();

const app = createApp(App);
app.use(router).mount("#app");

registerEventHandlers(router);
