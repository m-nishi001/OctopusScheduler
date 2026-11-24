import "reflect-metadata";
import { container } from "tsyringe";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { Container } from "./control/container/index";
import { JackpotContainer, installScreenBgmGuard, setDrawPoolProvider } from "@octopus/game-jackpot";
import { QuizContainer } from "@octopus/game-quiz";
import { AccountsContainer } from "@octopus/accounts";
import { SessionHubContainer } from "@octopus/session-hub";
import { PARTICIPANT_AUTH_KEY } from "@octopus/participant-portal";
import { SOUND_KEY } from "@octopus/composables/use-sound";
import type { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { exposeSoundProbe } from "@octopus/client-common/audio/sound-probe";
import router from "./control/router";
import { useAuthSession } from "./control/auth/auth-session";
import { ScreenRouterToken } from "./control/media/screen";
import { SoundSystemToken } from "./control/media/audio";
import { registerEventHandlers } from "./ui/composables/register-event-handlers";
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
// 音の中心を、ゲームの画面に渡す(ゲームのパッケージは DI を知らずに `useSound()` で受け取る)。e2e のときだけ、状態を読める窓口(`window.__sound`)を付ける。
const sound = container.resolve<SoundSystem>(SoundSystemToken);
app.provide(SOUND_KEY, sound);
exposeSoundProbe(sound);
// ジャックポットの画面が切り替わるとき、行き先と同じ曲なら流し続け、違えば止める。
installScreenBgmGuard(router, sound);
app.use(router).mount("#app");

container.registerInstance(ScreenRouterToken, router);
registerEventHandlers(router);

// ホスト端末なら、保存済みの入室情報からセッションへ復帰する(リロード対策)。
const hostAgent = setupHostAgent(router);
// ジャックポットの抽選の対象を、イベントの設定（参加者全員(自動) / エントリーした人だけ）に従わせる。
// JackpotContainer.register() のあとに差し替える（後から登録したものが優先される）。
setDrawPoolProvider(createSessionDrawPool(hostAgent));
