import { injectable } from "tsyringe";
import { ApiResponse, GasService, SuccessResponse } from "./gas-service";

@injectable()
export class TestService implements GasService{
    functionName: string = "fooFunc";
    invoke(...args: any[]): Promise<ApiResponse<string>> {
        return new Promise((resolve, reject) => resolve(new SuccessResponse(`fooFunc called with: ${args[0]}`)));
    }

}