import { injectable } from "tsyringe";
import { ApiResponse, GasService } from "../core/gas-service";
import { FolderId } from "../../infrastructure/google-drvie/value-object/folder-id";
import { GoogleDriveService } from "../../infrastructure/google-drvie/google-drive-service";
import { DataSize } from "../../infrastructure/google-drvie/value-object/data-size";
import { ErrorResponse } from "../core/response/error-response";
import { SuccessResponse } from "../core/response/success-response";

@injectable()
export class DriveService implements GasService {
    serviceName: string = "DriveService";
    functions: Record<string, (...args: any[]) => ApiResponse<any>> = {};

    constructor() {
        this.functions = {
            "readyZipping": this.readyZipping,
            "zip": this.zip
        }
    }

    private readyZipping(targetFolderId: string): ApiResponse<number> {
        const target = FolderId.create(targetFolderId);
        if (!target) return new ErrorResponse(`[readyZipping] targetFolderId is invalid. the value is ${targetFolderId}`);

        const result = GoogleDriveService.readyZipping(target, new DataSize(1, "MB"));
        return result ? new SuccessResponse(result) : new ErrorResponse("[readyZipping] ready zipping process was failed.");
    }

    private zip(args: any): ApiResponse<boolean>{
        const targetFolderId: string = args[0];
        const seq: number = args[1];

        Logger.log(`targetFolderId: ${targetFolderId} seq: ${seq}`);
        
        const target = FolderId.create(targetFolderId);
        if (!target) return new ErrorResponse(`[zip] targetFolderId is invalid. the value is ${targetFolderId}`);

        const result = GoogleDriveService.zip(target, seq);
        return result ? new SuccessResponse(result) : new ErrorResponse("[zip] zip process was failed.");
    }

}