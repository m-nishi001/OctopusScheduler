export function fooFunc(arg: string) {
  return `fooFunc called with: ${arg}`;
}

export function fugaFunc(value: number) {
  return `fugaFunc called with: ${value * 2}`;
}

// 他にも関数が増えるたびにここに追加
export function newFunc() {
  return "This is a new function!";
}

/**
 * WebアプリケーションにGETリクエストがあった場合に実行される内部関数。
 * @param {GoogleAppsScript.Events.DoGet} e イベントオブジェクト
 * @return {GoogleAppsScript.HTML.HtmlOutput} 表示するHTMLページ
 */
export function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  try {
    const template = HtmlService.createTemplate("<p>Test</p>");
    return template.evaluate()
      .setTitle('入社歓迎アプリ')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

  } catch (error) {
    console.error(`Error in doGetInternal: ${(error as Error).stack}`);
    return HtmlService.createHtmlOutput(
      `<html><body><h1>エラー</h1><p>アプリケーションの読み込みに失敗しました。</p></body></html>`
    );
  }
}