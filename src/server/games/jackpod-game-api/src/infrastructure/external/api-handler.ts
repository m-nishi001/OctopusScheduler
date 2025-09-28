import "reflect-metadata";
import { container } from "tsyringe";
import { GasService } from "../../application/services/gas-service";

type ApiResponse = SuccessResponse | ErrorResponse;

export class ErrorResponse {
  status: string = "error";
  message: string;
  date: string = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

  constructor(message: string) {
    this.message = message;
  }
}

export class SuccessResponse {
  status: string = "success";
  data: any;
  date: string = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

  constructor(data: any) {
    this.data = data;
  }
}

export class ApiHandler {
  static handle(callingObject: string, args: any): ApiResponse {
    Logger.log(
      `[jackpotGameAPI] Function: ${callingObject}, Args: ${JSON.stringify(args)}`
    );

    const [serviceName, functionName] =
      this.resolveServiceAndFunction(callingObject);
    if (!serviceName || !functionName) {
      Logger.log(`Error: "callingObject" was invalid: ${callingObject}`);
      return new ErrorResponse(`Invalid callingObject: ${callingObject}`);
    }

    Logger.log(
      `[JackpotGameAPI] Service: ${serviceName}, Function: ${functionName}`
    );

    const targetFunction = this.findTargetFunction(serviceName, functionName);
    if (!targetFunction) {
      Logger.log(
        `Error: Function "${functionName}" not found on service "${serviceName}".`
      );
      return new ErrorResponse(
        `Function "${functionName}" not found on service "${serviceName}".`
      );
    }

    return this.executeFunction(targetFunction, args);
  }

  private static resolveServiceAndFunction(
    callingObject: string
  ): [string | null, string | null] {
    const parts = callingObject.split(".", 2);
    return [parts[0] || null, parts[1] || null];
  }

  private static findTargetFunction(
    serviceName: string,
    functionName: string
  ): ((args: any) => any) | null {
    return (
      container
        .resolveAll<GasService>("IGasService")
        .filter((service) => service.serviceName === serviceName)
        .map((service) => service.functions[functionName])
        .find((func) => func !== undefined) || null
    );
  }

  private static executeFunction(
    targetFunction: (args: any) => any,
    args: any
  ): ApiResponse {
    try {
      const parameters = JSON.parse(args);
      const result = targetFunction(parameters);
      return new SuccessResponse(result);
    } catch (e: any) {
      return new ErrorResponse(e);
    }
  }
}
