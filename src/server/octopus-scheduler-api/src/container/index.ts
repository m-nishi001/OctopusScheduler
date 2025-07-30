import { container } from "tsyringe";
import { GasService } from "../application/core/gas-service";
import { TestService } from "../application/test-service";
import { DriveService } from "../application/drive/drive-service";

export class Container {
    static regiser() {
        container.register<GasService>("IGasService", { useClass: TestService });
        container.register<GasService>("IGasService", { useClass: DriveService });
    }
}