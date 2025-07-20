import "reflect-metadata";
import { container } from "tsyringe";
import { Container } from "./container";
import { ApiResponse, GasService } from "./api/gas-service";

declare let _doGet: (e: GoogleAppsScript.Events.DoGet) => GoogleAppsScript.HTML.HtmlOutput;
declare let _callOctopusSchedulerApi: (functionName: string, ...args: any[]) => any;

/**
 * クライアントからの関数呼び出しを中継する内部ディスパッチャー関数。
 * @param {string} functionName 呼び出す関数の名前 (ClientApiクラスのメソッド名)。
 * @param {...any[]} args 関数に渡す引数。
 * @returns {any} 呼び出された関数の戻り値。
 * @throws {Error} 指定された関数名が見つからない場合。
 */
function callOctopusSchedulerApiInternal(functionName: string, ...args: any[]): Promise<ApiResponse<any>> {
  Logger.log(`API call received for: ${functionName}`);

  // ここでコンテナへの型登録をする
  Container.regiser();

  const services = container.resolveAll<GasService>("IGasService")
  const targetService = services.find(service => service.functionName === functionName);
  if (targetService) {
    return targetService.invoke(args);
  }

  Logger.log(`Error: Unknown function name "${functionName}" was called.`);
  throw new Error(`Unknown API function name: ${functionName}`);
}

// これはPromise型で返却することができないのでとりあえずここで実装する。
// （GAS側の型チェックに引っかかる模様）
_doGet = (e: GoogleAppsScript.Events.DoGet) => {
  try {
    const template = HtmlService.createTemplateFromFile("octopus-scheduler-index");
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

_callOctopusSchedulerApi = async (functionName: string, ...args: any[]) => {
  const response = await callOctopusSchedulerApiInternal(functionName, args);
  return JSON.stringify(response);
}