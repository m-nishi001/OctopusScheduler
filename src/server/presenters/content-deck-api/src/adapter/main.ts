import "reflect-metadata";
import { container } from "tsyringe";
import { Container } from "../container";
import { GasService } from "../application/gas-service";
import { ApiResponse } from "./response/api-response";
import { ErrorResponse } from "./response/error-response";
import { SuccessResponse } from "./response/success-response";

declare let _callContentDockApi: (functionName: string, args: any) => any;

/**
 * クライアントからの関数呼び出しを中継する内部ディスパッチャー関数。
 * @param {string} callingObject 呼び出す関数の名前
 * @param {any} args 関数に渡す引数。
 * @returns {any} 呼び出された関数の戻り値。
 * @throws {Error} 指定された関数名が見つからない場合。
 */
function callContentDockApiInternal(callingObject: string, args: any): ApiResponse {
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
    Logger.log(`[Main.ts] callContentDockApiInternal current service name: ${service.serviceName} target service name: ${serviceName}`);
    return service.serviceName === serviceName
  });
  if (targetService) {
    try {
      const result = (targetService as any)[functionName](JSON.parse(args));
      Logger.log(`[callContentDockrApiInternal] result: ${JSON.stringify(result)}`);
      return new SuccessResponse(result);
    } catch (e: any) {
      return new ErrorResponse(e);
    }
  }

  Logger.log(`Error: Unknown function name "${callingObject}" was called.`);
  return new ErrorResponse(`Unknown API function name: ${callingObject}`);
}

_callContentDockApi = async (functionName: string, args: any) => {
  const response = callContentDockApiInternal(functionName, args);
  return JSON.stringify(response);
}