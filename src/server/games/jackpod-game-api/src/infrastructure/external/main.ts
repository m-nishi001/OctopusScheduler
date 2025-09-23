import "reflect-metadata";
import { container } from "tsyringe";
import { Container } from "../../container";
import { JackpodGasService } from "../../application/services/jackpod-gas-service";

declare let _doGet: (e: GoogleAppsScript.Events.DoGet) => GoogleAppsScript.HTML.HtmlOutput;
declare let _callJackpodGameApi: (functionName: string, args: any) => any;

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

function callJackpodGameApiInternal(callingObject: string, args: any): ApiResponse {
  Logger.log(`[JackpodGameAPI] Function: ${callingObject}, Args: ${JSON.stringify(args)}`);

  const [serviceName, functionName] = callingObject.split(".", 2);
  if (!serviceName || !functionName) {
    Logger.log(`Error: "callingObject" was invalid: ${callingObject}`);
    return new ErrorResponse(`Invalid callingObject: ${callingObject}`);
  }

  Container.regiser();

  const targetFunction = container
    .resolveAll<JackpodGasService>("IJackpodGasService")
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

_doGet = (e: GoogleAppsScript.Events.DoGet) => {
  try {
    try {
      LockService.getScriptLock().releaseLock();
    } catch {
    }
    const template = HtmlService.createTemplateFromFile("index");
    return template.evaluate()
      .setTitle('Jackpod App')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    console.error(`Error in doGetInternal: ${(error as Error).stack}`);
    return HtmlService.createHtmlOutput(
      `<html><body><h1>エラー</h1><p>アプリケーションの読み込みに失敗しました。</p></body></html>`
    );
  }
}

_callJackpodGameApi = async (functionName: string, args: any) => {
  const response = callJackpodGameApiInternal(functionName, args);
  return JSON.stringify(response);
}
