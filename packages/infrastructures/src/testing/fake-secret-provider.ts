import type { ISecretProvider } from "../interfaces/secret-provider";

/** テスト用の `ISecretProvider`。渡した値だけを返す。 */
export class FakeSecretProvider implements ISecretProvider {
  constructor(private readonly values: Record<string, string> = {}) {}

  get(name: string): string | null {
    return this.values[name] || null;
  }
}
