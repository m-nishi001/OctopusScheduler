import { container } from "tsyringe";
import { GasService } from "../api/gas-service";
import { TestService } from "../api/test-service";

export class Container {
    static regiser() {
        container.register<GasService>("IGasService", { useClass: TestService });
    }
}