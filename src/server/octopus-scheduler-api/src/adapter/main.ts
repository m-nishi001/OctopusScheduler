import "reflect-metadata";
import { container } from "tsyringe";
import { Container } from "../container";
import { GasService } from "../application/gas-service";

declare let _doGet: (e: GoogleAppsScript.Events.DoGet) => GoogleAppsScript.HTML.HtmlOutput;
declare let _callOctopusSchedulerApi: (functionName: string, args: any) => any;

type ApiResponse = SuccessResponse | ErrorResponse;

export class ErrorResponse {
  status: string = 'error';
  message: string;
  date: string = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

  constructor(message: string) {
    this.message = message;
  }
};

export class SuccessResponse {
  status: string = 'success';
  data: any;
  date: string = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

  constructor(data: any) {
    this.data = data;
  }
};

/**
 * クライアントからの関数呼び出しを中継する内部ディスパッチャー関数。
 * @param {string} callingObject 呼び出す関数の名前
 * @param {any} args 関数に渡す引数。
 * @returns {any} 呼び出された関数の戻り値。
 * @throws {Error} 指定された関数名が見つからない場合。
 */
function callOctopusSchedulerApiInternal(callingObject: string, args: any): ApiResponse {
  Logger.log(`API call received for: ${callingObject} args: ${args}`);

  // {ServiceName}.{FunctionName}の形式でやってくるのでパースする。
  const splited = callingObject.split(".");
  if (splited.length !== 2) {
    Logger.log(`Error: "callingObject" was invalid. ${callingObject}`);
    return new ErrorResponse(`Invalid callingObjecgt: ${callingObject}`);
  }

  const serviceName = splited[0];
  const functionName = splited[1];

  // ここでコンテナへの型登録をする
  Container.regiser();

  const services = container.resolveAll<GasService>("IGasService")
  const targetService = services.find(service => {
    Logger.log(`[Main.ts] callOctopusSchedulerApiInternal current service name: ${service.serviceName} target service name: ${serviceName}`);
    return service.serviceName === serviceName
  });
  if (targetService) {
    try {
      const result = (targetService as any)[functionName](JSON.parse(args));
      // Logger.log(`[callOctopusSchedulerApiInternal] result: ${JSON.stringify(result)}`);
      return new SuccessResponse(result);
    } catch (e: any) {
      return new ErrorResponse(e);
    }
  }

  Logger.log(`Error: Unknown function name "${callingObject}" was called.`);
  return new ErrorResponse(`Unknown API function name: ${callingObject}`);
}

// これはPromise型で返却することができないのでとりあえずここで実装する。
// （GAS側の型チェックに引っかかる模様）
_doGet = (e: GoogleAppsScript.Events.DoGet) => {
  try {
    const template = HtmlService.createTemplateFromFile("index");
    return template.evaluate()
      .setTitle('Fail Loading...')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

  } catch (error) {
    console.error(`Error in doGetInternal: ${(error as Error).stack}`);
    return HtmlService.createHtmlOutput(
      `<html><body><h1>エラー</h1><p>アプリケーションの読み込みに失敗しました。</p></body></html>`
    );
  }
}

_callOctopusSchedulerApi = async (functionName: string, args: any) => {
  const response = callOctopusSchedulerApiInternal(functionName, args);
  return JSON.stringify(response);
}