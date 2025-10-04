import "reflect-metadata";
import { Container } from "./container/index";
import { ApiHandler } from "./api-handler";

declare let _doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;
declare let _callCardGameApi: (functionName: string, ...args: any[]) => any;

function callCardGameApiInternal(functionName: string, ...args: any[]) {
  Container.register();
  return ApiHandler.handle(functionName, args[0]);
}

_callCardGameApi = callCardGameApiInternal;
