import { injectable } from "tsyringe";
import type { IKeyValueRepository } from "../interfaces/key-value-repository";

@injectable()
export class GasKeyValueRepository implements IKeyValueRepository {
  get(key: string): string | null {
    return PropertiesService.getScriptProperties().getProperty(key);
  }

  set(key: string, value: string): void {
    PropertiesService.getScriptProperties().setProperty(key, value);
  }
}
