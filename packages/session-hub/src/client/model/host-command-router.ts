import type { Command } from "../../shared/session-types";

export type CommandHandler = (command: Command) => void | Promise<void>;

/**
 * ホストが受け取ったコマンドを、ゲーム名前空間(`command.game`)ごとの処理へ振り分ける。
 * 各ゲーム/機能が自分の名前空間のハンドラを登録する(例: "session" / "jackpot" / "quiz")。
 * 未登録の名前空間のコマンドは無視する(新しい管理画面が古いホストにコマンドを送っても壊れない)。
 */
export class HostCommandRouter {
  private readonly handlers = new Map<string, CommandHandler>();

  /** 登録する。戻り値は登録解除関数(画面の破棄時に呼ぶ)。同じ名前空間は後勝ち。 */
  register(game: string, handler: CommandHandler): () => void {
    this.handlers.set(game, handler);
    return () => {
      if (this.handlers.get(game) === handler) this.handlers.delete(game);
    };
  }

  async dispatch(command: Command): Promise<void> {
    const handler = this.handlers.get(command.game);
    if (handler) await handler(command);
  }

  has(game: string): boolean {
    return this.handlers.has(game);
  }
}
