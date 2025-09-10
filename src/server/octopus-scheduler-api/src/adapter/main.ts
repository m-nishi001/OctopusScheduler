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
  Logger.log(`[OctopusSchedulerAPI] Function: ${callingObject}, Args: ${JSON.stringify(args)}`);

  // {ServiceName}.{FunctionName}の形式でやってくるのでパースする。
  const [serviceName, functionName] = callingObject.split(".", 2);
  if (!serviceName || !functionName) {
    Logger.log(`Error: "callingObject" was invalid: ${callingObject}`);
    return new ErrorResponse(`Invalid callingObject: ${callingObject}`);
  }

  // ここでコンテナへの型登録をする
  Container.regiser();

  const targetFunction = container
    .resolveAll<GasService>("IGasService")
    .filter(service => service.serviceName === serviceName)
    .map(service => service.functions[functionName])
    .find(func => func !== undefined);

  if (!targetFunction) {
    Logger.log(`Error: Function "${functionName}" not found on service "${serviceName}".`);
    return new ErrorResponse(`Function "${functionName}" not found on service "${serviceName}".`);
  }

  try {
    const parameters = JSON.parse(args);
    const result = targetFunction(parameters);
    return new SuccessResponse(result);
  } catch (e: any) {
    return new ErrorResponse(e);
  }
}

// これはPromise型で返却することができないのでとりあえずここで実装する。
// （GAS側の型チェックに引っかかる模様）
_doGet = (e: GoogleAppsScript.Events.DoGet) => {
  try {
    const template = HtmlService.createTemplateFromFile("index");
    return template.evaluate()
      .setTitle('Sample App')
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