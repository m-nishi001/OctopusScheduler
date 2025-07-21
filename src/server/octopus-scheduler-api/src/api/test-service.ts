import { injectable } from "tsyringe";
import { ApiResponse, GasService, SuccessResponse } from "./gas-service";

@injectable()
export class TestService implements GasService {

    serviceName: string = "TestService";
    functions: Record<string, (...args: any) => ApiResponse<any>>;

    constructor() {
        this.functions = {
            "fooFunc": this.fooFunc
        }
    }

    fooFunc(arg: string): ApiResponse<string> {
        return new SuccessResponse(`fooFunc called with: ${arg}`);
    }

}