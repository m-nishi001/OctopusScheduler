import "reflect-metadata";
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { Container } from "./core/container/index";
import router from "./core/router";
import { EventPollingService } from "./model/applications/event-polling-service";
import { AssetService } from "./model/applications/assets/asset-service";
import { container } from "tsyringe";
import { useAudio } from "../../packages/shared-composables/src/use-audio";
import { registerEventHandlers } from "./ui/components/schedule-event-handler/register-event-handlers";

Container.Register();

const app = createApp(App);
const eventPollingService = new EventPollingService();
const assetService = container.resolve<AssetService>("AssetService");
const audio = useAudio();
app.provide("eventPollingService", eventPollingService);
app.provide("assetService", assetService);
app.provide("audio", audio);
app.use(router).mount("#app");

registerEventHandlers(audio, assetService, router);
