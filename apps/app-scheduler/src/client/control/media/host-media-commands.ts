import { container } from "tsyringe";
import type { HostAgent } from "@octopus/session-hub";
import { MEDIA_NS, parseMediaCommand } from "@model/media/media-command";
import { AudioControl } from "./audio";
import { ScreenControl } from "./screen";

export interface MediaControls {
  audio: Pick<AudioControl, "play" | "stop">;
  screen: Pick<ScreenControl, "show" | "clear">;
}

const defaultControls = (): MediaControls => ({
  audio: container.resolve(AudioControl),
  screen: container.resolve(ScreenControl),
});

/**
 * ホストが `media` 名前空間の指示を受けて、音楽とスクリーンを動かす。
 *   - `media.play { assetId }` / `media.stop { assetId?, fadeSec? }` : 音楽
 *   - `media.show { spec }` / `media.clear` : スクリーン
 * 信頼境界はホスト側。参加者(client)からの指示は捨て、検証に通らないペイロードは警告を出して捨てる。
 * 素材の取得を待たない(待つと、あとに来た「消す」「止める」が取得の完了まで処理されないため)。
 * 取得を待つ間に別の指示が来たときの扱いは、`AudioControl` / `ScreenControl` が決める。
 */
export function registerMediaCommands(agent: HostAgent, controls: () => MediaControls = defaultControls): () => void {
  return agent.router.register(MEDIA_NS, (command) => {
    if (command.issuerRole === "client") return;
    const parsed = parseMediaCommand(command.type, command.payload);
    if (!parsed) {
      console.warn(`media.${command.type} のペイロードが正しくないため、無視しました`);
      return;
    }
    const { audio, screen } = controls();
    const task = (() => {
      switch (parsed.type) {
        case "play":
          return audio.play(parsed.assetId);
        case "stop":
          return audio.stop(parsed.assetId, parsed.fadeSec);
        case "show":
          return screen.show(parsed.spec);
        case "clear":
          return screen.clear();
      }
    })();
    task.catch((error) => console.error(`media.${parsed.type} を実行できませんでした`, error));
  });
}
