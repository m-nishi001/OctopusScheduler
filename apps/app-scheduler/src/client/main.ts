import "reflect-metadata";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { Container } from "./control/container/index";
import { JackpotContainer } from "@octopus/game-jackpot";
import { QuizContainer } from "@octopus/game-quiz";
import router from "./control/router";
import { registerEventHandlers } from "./ui/composables/register-event-handlers";
import { registerKeyboardShortcutListener } from "./ui/composables/keyboard-shortcut-listener";

// Register app-specific DI
Container.register();
// Also register DI for embedded jackpot/quiz game components
JackpotContainer.register();
QuizContainer.register();

const app = createApp(App);
app.use(router).mount("#app");

registerEventHandlers(router);

// キーボードショートカットリスナー
registerKeyboardShortcutListener();
