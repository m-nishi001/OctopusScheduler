declare namespace google {
  namespace script {
    interface History {
      push(
        state: object | null,
        params?: { [key: string]: string },
        hash?: string
      ): void;
      replace(
        state: object | null,
        params?: { [key: string]: string },
        hash?: string
      ): void;
      setChangeHandler(
        callback: (event: { state: object; location: Location }) => void
      ): void;
    }

    interface Location {
      hash: string;
      parameter: { [key: string]: string };
      parameters: { [key: string]: string[] };
    }

    interface Url {
      getLocation(callback: (location: Location) => void): void;
    }

    const history: History;
    const url: Url;
  }
}

/** GAS の実行環境か。Cloudflare・ローカルでは `google` が無いので、履歴の操作は何もしない（警告も出さない）。 */
function isGasRuntime(): boolean {
  return typeof google !== "undefined";
}

/** GAS の画面の履歴(戻る・進む)への窓口。GAS 以外の環境では何もしない。 */
export class HistoryService {
  static push(
    state: object | null,
    params?: { [key: string]: string },
    bookmark?: string
  ): void {
    if (!isGasRuntime()) return;
    google.script.history.push(state, params, bookmark);
  }

  static replace(
    state: object | null,
    params?: { [key: string]: string },
    hash?: string
  ): void {
    if (!isGasRuntime()) return;
    google.script.history.replace(state, params, hash);
  }

  static setChangeHandler(
    handler: (event: {
      state: object;
      location: google.script.Location;
    }) => void
  ): void {
    if (!isGasRuntime()) return;
    google.script.history.setChangeHandler(handler);
  }

  /**
   * GASのiframe内ではURLのハッシュがwindow.locationから見えないため、
   * google.script.url.getLocation(公式API)から初期ハッシュ(先頭の#なし)を非同期に取得する。
   * GAS以外の環境、または取得できない場合は空文字を返す。
   */
  static getInitialHash(): Promise<string> {
    if (typeof google === "undefined" || !google.script.url?.getLocation) {
      return Promise.resolve("");
    }
    return new Promise((resolve) => {
      try {
        google.script.url.getLocation((location) => {
          resolve(location?.hash ?? "");
        });
      } catch {
        resolve("");
      }
    });
  }
}
