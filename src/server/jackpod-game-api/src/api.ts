// import "reflect-metadata";
import * as api from './api/ClientApi';

declare let _doGet: (e: GoogleAppsScript.Events.DoGet) => GoogleAppsScript.HTML.HtmlOutput;
declare let _callCustomFunction: (functionName: string, ...args: any[]) => any;

// --- APIディスパッチャ ---

/**
 * クライアントからの関数呼び出しを中継する内部ディスパッチャー関数。
 * @param {string} functionName 呼び出す関数の名前 (ClientApiクラスのメソッド名)。
 * @param {...any[]} args 関数に渡す引数。
 * @returns {any} 呼び出された関数の戻り値。
 * @throws {Error} 指定された関数名が見つからない場合。
 */
function callCustomFunctionInternal(functionName: string, ...args: any[]): any {
  Logger.log(`API call received for: ${functionName}`);

  if (functionName in api && typeof (api as any)[functionName] === 'function') {
    return JSON.stringify((api as any)[functionName](...args));
  } else {
    Logger.log(`Error: Unknown function name "${functionName}" was called.`);
    throw new Error(`Unknown API function name: ${functionName}`);
  }
}


// === 内部関数をグローバル変数に代入 ===
// ビルドツールのフッター機能などでグローバル関数として公開されるようにする
_doGet = api.doGet;
_callCustomFunction = callCustomFunctionInternal;
