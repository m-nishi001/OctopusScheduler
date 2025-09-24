import "reflect-metadata";
import { container } from "tsyringe";
import { Container } from "../../container";
import { GasService } from "../../application/services/gas-service";

// declare let _doGet: (e: GoogleAppsScript.Events.DoGet) => GoogleAppsScript.HTML.HtmlOutput;
declare let _calljackpotGameApi: (functionName: string, args: any) => any;

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

function calljackpotGameApiInternal(callingObject: string, args: any): ApiResponse {
    Logger.log(`[jackpotGameAPI] Function: ${callingObject}, Args: ${JSON.stringify(args)}`);

    const [serviceName, functionName] = callingObject.split(".", 2);
    if (!serviceName || !functionName) {
        Logger.log(`Error: "callingObject" was invalid: ${callingObject}`);
        return new ErrorResponse(`Invalid callingObject: ${callingObject}`);
    }

    Logger.log(`[JackpotGameAPI] Service: ${serviceName}, Function: ${functionName}`);

    Container.register();

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

_calljackpotGameApi = async (functionName: string, args: any) => {
    const response = calljackpotGameApiInternal(functionName, args);
    return JSON.stringify(response);
}