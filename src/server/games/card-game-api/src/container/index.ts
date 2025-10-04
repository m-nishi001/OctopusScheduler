import { container } from "tsyringe";
import { TestService } from "../services/test-service";

export class Container {
  static register() {
    container.register("TestService", { useClass: TestService });
  }
}
