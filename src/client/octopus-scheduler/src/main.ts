import "reflect-metadata";
import { createApp } from "vue";
import { container } from "tsyringe";
import "./style.css";
import App from "./App.vue";
import { Container } from "./core/container/index";
import router from "./core/router";
import { registerEventHandlers } from "./ui/components/schedule-event-handler/register-event-handlers";
import { KeyboardShortcutService } from "./model/applications/keyboard-shortcut/keyboard-shortcut-service";

Container.Register();

const app = createApp(App);
app.use(router).mount("#app");

registerEventHandlers(router);

// キーボードショートカットリスナー
const keyboardShortcutService = container.resolve(KeyboardShortcutService);
window.addEventListener("keydown", async (event) => {
  // 入力フィールド内は無視
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  )
    return;

  const keys = [];
  if (event.ctrlKey) keys.push("Control");
  if (event.shiftKey) keys.push("Shift");
  if (event.altKey) keys.push("Alt");
  if (event.metaKey) keys.push("Meta");
  keys.push(event.key);

  const enabled = await keyboardShortcutService.isEnabled();
  if (!enabled) return;

  const shortcut = await keyboardShortcutService.findShortcutByKeys(keys);
  if (shortcut) {
    event.preventDefault();
    await shortcut.execute();
  }
});
