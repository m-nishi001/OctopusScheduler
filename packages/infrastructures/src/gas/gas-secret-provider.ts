import { injectable } from "tsyringe";
import type { ISecretProvider } from "../interfaces/secret-provider";

/** ISecretProvider の GAS 実装(ScriptProperty)。 */
@injectable()
export class GasSecretProvider implements ISecretProvider {
  get(name: string): string | null {
    return PropertiesService.getScriptProperties().getProperty(name) || null;
  }
}
