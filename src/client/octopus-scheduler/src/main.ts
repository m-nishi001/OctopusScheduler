import "reflect-metadata";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { Container } from "./core/container/index";
import { Container as JackpotContainer } from "games/jackpot-game/core/container";
import router from "./core/router";
import { registerEventHandlers } from "./ui/components/app-event-handler/register-event-handlers";
import { registerKeyboardShortcutListener } from "./ui/components/keyboard-shortcut/keyboard-shortcut-listener";

// Register app-specific DI
Container.Register();
// Also register DI for embedded jackpot game components
JackpotContainer.register();

const app = createApp(App);
app.use(router).mount("#app");

registerEventHandlers(router);

// キーボードショートカットリスナー
registerKeyboardShortcutListener();
