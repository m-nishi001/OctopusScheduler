import { injectable } from "tsyringe";
import { GasService } from "./core/gas-service";
import { SuccessResponse } from "../adapter/response/success-response";
import { runSpreadSheetServiceTest } from "../infrastructure/google-spreadsheet/example/spread-sheet-service-test";

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
        runSpreadSheetServiceTest();

        return new SuccessResponse(`fooFunc called with: ${arg}`);
    }

}