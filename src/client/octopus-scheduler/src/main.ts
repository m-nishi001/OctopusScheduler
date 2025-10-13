import "reflect-metadata";
import { createApp, reactive } from "vue";
import "./style.css";
import App from "./App.vue";
import { Container } from "./core/container/index";
import router from "./core/router";
import { EventPollingService } from "./model/applications/event-polling-service";
import { AssetService } from "./model/applications/assets/asset-service";
import { container } from "tsyringe";

Container.Register();

const app = createApp(App);
const eventPollingService = new EventPollingService();
const assetService = container.resolve<AssetService>("AssetService");
const globalState = reactive({
  audioUrl: "",
  videoUrl: "",
  imageAssetUrl: "",
  htmlContent: "",
  showVideoModal: false,
  showImageModal: false,
  showHtmlModal: false,
  isAudioPlaying: false,
  audioError: null,
  nextPage: null as string | null,
});
app.provide("eventPollingService", eventPollingService);
app.provide("assetService", assetService);
app.provide("globalState", globalState);
app.use(router).mount("#app");
