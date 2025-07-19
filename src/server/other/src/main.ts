/**
 * @file Code.ts
 * @description GASプロジェクトのメインエントリーポイント。
 * Web AppのGETリクエスト処理と、クライアントからのAPI呼び出しを中継する。
 */
import "reflect-metadata";
import { ClientApi } from './api/ClientApi';

// --- グローバル変数の宣言 (esbuild等のバナー機能で注入されることを想定) ---
// これにより、ビルド後のスクリプトでグローバル関数として公開される。
declare let _doGet: (e: GoogleAppsScript.Events.DoGet) => GoogleAppsScript.HTML.HtmlOutput;
declare let _callCustomFunction: (functionName: string, ...args: any[]) => any;


// === 内部関数の実装 ===

/**
 * WebアプリケーションにGETリクエストがあった場合に実行される内部関数。
 * @param {GoogleAppsScript.Events.DoGet} e イベントオブジェクト
 * @return {GoogleAppsScript.HTML.HtmlOutput} 表示するHTMLページ
 */
function doGetInternal(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  try {
    const template = HtmlService.createTemplateFromFile("index");
    // 必要に応じて、HTMLテンプレートに変数を渡すことができる
    // template.webAppUrl = ScriptApp.getService().getUrl();

    return template.evaluate()
      .setTitle('入社歓迎アプリ')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

  } catch (error) {
    console.error(`Error in doGetInternal: ${(error as Error).stack}`);
    // ユーザーフレンドリーなエラーページを返す
    return HtmlService.createHtmlOutput(
      `<html><body><h1>エラー</h1><p>アプリケーションの読み込みに失敗しました。</p></body></html>`
    );
  }
}

// --- APIディスパッチャ ---

// ClientApiのシングルトンインスタンスを生成
const api = new ClientApi();

/**
 * クライアントからの関数呼び出しを中継する内部ディスパッチャー関数。
 * @param {string} functionName 呼び出す関数の名前 (ClientApiクラスのメソッド名)。
 * @param {...any[]} args 関数に渡す引数。
 * @returns {any} 呼び出された関数の戻り値。
 * @throws {Error} 指定された関数名が見つからない場合。
 */
function callCustomFunctionInternal(functionName: string, ...args: any[]): any {
  Logger.log(`API call received for: ${functionName}`);

  // ClientApiのインスタンスに、指定された名前のメソッドが存在し、かつそれが関数であるかを確認
  if (functionName in api && typeof (api as any)[functionName] === 'function') {
    // メソッドを動的に呼び出し、引数を展開して渡す
    return JSON.stringify((api as any)[functionName](...args));
  } else {
    // 該当するメソッドが存在しない場合はエラーを投げる
    Logger.log(`Error: Unknown function name "${functionName}" was called.`);
    throw new Error(`Unknown API function name: ${functionName}`);
  }
}


// === 内部関数をグローバル変数に代入 ===
// ビルドツールのフッター機能などでグローバル関数として公開されるようにする
_doGet = doGetInternal;
_callCustomFunction = callCustomFunctionInternal;
