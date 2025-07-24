import "reflect-metadata";
import { container } from "tsyringe";
import { Container } from "./container";
import { GasService } from "./application/core/gas-service";
import { ApiResponse } from "./application/core/response/api-response";

declare let _doGet: (e: GoogleAppsScript.Events.DoGet) => GoogleAppsScript.HTML.HtmlOutput;
declare let _callOctopusSchedulerApi: (functionName: string, ...args: any[]) => any;

/**
 * クライアントからの関数呼び出しを中継する内部ディスパッチャー関数。
 * @param {string} callingObject 呼び出す関数の名前 (ClientApiクラスのメソッド名)。
 * @param {...any[]} args 関数に渡す引数。
 * @returns {any} 呼び出された関数の戻り値。
 * @throws {Error} 指定された関数名が見つからない場合。
 */
function callOctopusSchedulerApiInternal(callingObject: string, ...args: any[]): Promise<ApiResponse<any>> {
  Logger.log(`API call received for: ${callingObject}`);
  
  // {ServiceName}.{FunctionName}の形式でやってくるのでパースする。
  const splited = callingObject.split(".");
  if(splited.length !== 2){
    Logger.log(`Error: "callingObject" was invalid. ${callingObject}`);
    throw new Error(`Invalid callingObjecgt: ${callingObject}`);
  }

  const serviceName = splited[0];
  const functionName = splited[1];

  // ここでコンテナへの型登録をする
  Container.regiser();

  const services = container.resolveAll<GasService>("IGasService")
  const targetService = services.find(service => service.serviceName === serviceName);
  if (targetService) {
    return (targetService as any)[functionName](args);
  }

  Logger.log(`Error: Unknown function name "${callingObject}" was called.`);
  throw new Error(`Unknown API function name: ${callingObject}`);
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