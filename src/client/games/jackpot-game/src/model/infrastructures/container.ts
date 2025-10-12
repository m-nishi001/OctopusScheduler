import "reflect-metadata";
import { container } from "tsyringe";
import { ScreenConfigRepository } from "./repositories/screen-config-repository";
import { ScreenConfigService } from "../applications/screen-config/screen-config-service";
import { ScreenConfigConverterManager } from "../applications/screen-config/screen-config-converter-manager";

container.register("IScreenConfigRepository", {
  useClass: ScreenConfigRepository,
});
container.register(ScreenConfigService, {
  useClass: ScreenConfigService,
});
container.register(ScreenConfigConverterManager, {
  useClass: ScreenConfigConverterManager,
});

export { container };
