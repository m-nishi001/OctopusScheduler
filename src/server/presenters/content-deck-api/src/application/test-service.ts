import { injectable } from "tsyringe";
import { GasService } from "./gas-service";
import { SuccessResponse } from "../adapter/response/success-response";

@injectable()
export class TestService implements GasService {

    serviceName: string = "TestService";
    functions: Record<string, (args: any) => any>;

    constructor() {
        this.functions = {
            "fooFunc": this.fooFunc
        }
    }

    fooFunc(arg: string): any {

        // runDriveServiceTest()

        return new SuccessResponse(`fooFunc called with: ${arg}`);
    }

}