import "reflect-metadata";
import { Container } from "../../container";
import { ApiHandler } from "./api-handler";

declare let _calljackpotGameApi: (functionName: string, args: any) => any;

function calljackpotGameApiInternal(callingObject: string, args: any) {
  Container.register();
  return ApiHandler.handle(callingObject, args);
}

_calljackpotGameApi = async (functionName: string, args: any) => {
  const response = calljackpotGameApiInternal(functionName, args);
  return JSON.stringify(response);
};
