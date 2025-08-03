import { injectable } from "tsyringe";
import { GasService } from "../gas-service";
import { FolderId } from "../../infrastructure/google-drvie/value-object/folder-id";
import { GoogleDriveService } from "../../infrastructure/google-drvie/google-drive-service";
import { DataSize } from "../../infrastructure/google-drvie/value-object/data-size";

@injectable()
export class DriveService implements GasService {
    serviceName: string = "DriveService";
    functions: Record<string, (args: any) => any> = {};

    constructor() {
        this.functions = {
            "readyZipping": this.readyZipping,
            "zip": this.zip
        }
    }

    private readyZipping(targetFolderId: string): number {
        const target = FolderId.create(targetFolderId);
        if (!target) throw new Error(`[readyZipping] targetFolderId is invalid. the value is ${targetFolderId}`);

        const result = GoogleDriveService.readyZipping(target, new DataSize(1, "MB"));
        if (!result) throw new Error("[readyZipping] ready zipping process was failed.");

        return result;
    }

    private zip(args: any): boolean {
        const targetFolderId: string = args[0];
        const seq: number = args[1];

        Logger.log(`targetFolderId: ${targetFolderId} seq: ${seq}`);

        const target = FolderId.create(targetFolderId);
        if (!target) throw new Error(`[zip] targetFolderId is invalid. the value is ${targetFolderId}`);

        const result = GoogleDriveService.zip(target, seq);
        if (!result) throw new Error("[zip] zip process was failed.");

        return result;
    }

}