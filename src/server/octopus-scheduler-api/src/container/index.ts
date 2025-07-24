import { container } from "tsyringe";
import { GasService } from "../application/core/gas-service";
import { TestService } from "../application/test-service";

export class Container {
    static regiser() {
        container.register<GasService>("IGasService", { useClass: TestService });
    }
}