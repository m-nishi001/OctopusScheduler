import "reflect-metadata";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { Container } from "./control/container/index";
import { JackpotContainer, setDrawPoolProvider } from "@octopus/game-jackpot";
import { QuizContainer } from "@octopus/game-quiz";
import { AccountsContainer } from "@octopus/accounts";
import { SessionHubContainer } from "@octopus/session-hub";
import { PARTICIPANT_AUTH_KEY } from "@octopus/participant-portal";
import router from "./control/router";
import { useAuthSession } from "./control/auth/auth-session";
import { registerEventHandlers } from "./ui/composables/register-event-handlers";
import { registerKeyboardShortcutListener } from "./ui/composables/keyboard-shortcut-listener";
import { setupHostAgent } from "./control/session/host-agent-setup";
import { createSessionDrawPool } from "./control/session/event-host";

// Register app-specific DI
Container.register();
// Also register DI for embedded jackpot/quiz game components
JackpotContainer.register();
QuizContainer.register();
AccountsContainer.register();
SessionHubContainer.register();

const app = createApp(App);
// 参加者ポータルに、ログイン中のメンバーとログアウト操作を渡す(ログインの実装はアプリ側にある)。
app.provide(PARTICIPANT_AUTH_KEY, useAuthSession());
app.use(router).mount("#app");

registerEventHandlers(router);

// ホスト端末なら、保存済みの入室情報からセッションへ復帰する(リロード対策)。
const hostAgent = setupHostAgent(router);
// ジャックポットの抽選の対象を、イベントの設定（参加者全員(自動) / エントリーした人だけ）に従わせる。
// JackpotContainer.register() のあとに差し替える（後から登録したものが優先される）。
setDrawPoolProvider(createSessionDrawPool(hostAgent));

// キーボードショートカットリスナー
registerKeyboardShortcutListener();
