import "reflect-metadata";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { Container } from "./core/container/index";
import { JackpotContainer } from "@octopus/game-jackpot";
import { QuizContainer } from "@octopus/game-quiz";
import router from "./core/router";
import { registerEventHandlers } from "./ui/components/app-event-handler/register-event-handlers";
import { registerKeyboardShortcutListener } from "./ui/composables/keyboard-shortcut-listener";

// Register app-specific DI
Container.Register();
// Also register DI for embedded jackpot/quiz game components
JackpotContainer.register();
QuizContainer.register();

const app = createApp(App);
app.use(router).mount("#app");

registerEventHandlers(router);

// キーボードショートカットリスナー
registerKeyboardShortcutListener();
