import "reflect-metadata";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { Container } from "./control/container/index";
import { JackpotContainer } from "@octopus/game-jackpot";
import { QuizContainer } from "@octopus/game-quiz";
import { AccountsContainer } from "@octopus/accounts";
import { SessionHubContainer } from "@octopus/session-hub";
import router from "./control/router";
import { registerEventHandlers } from "./ui/composables/register-event-handlers";
import { registerKeyboardShortcutListener } from "./ui/composables/keyboard-shortcut-listener";
import { setupHostAgent } from "./control/session/host-agent-setup";

// Register app-specific DI
Container.register();
// Also register DI for embedded jackpot/quiz game components
JackpotContainer.register();
QuizContainer.register();
AccountsContainer.register();
SessionHubContainer.register();

const app = createApp(App);
app.use(router).mount("#app");

registerEventHandlers(router);

// ホスト端末なら、保存済みの入室情報からセッションへ復帰する(リロード対策)。
setupHostAgent(router);

// キーボードショートカットリスナー
registerKeyboardShortcutListener();
