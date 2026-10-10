import type { ISecretProvider } from "../interfaces/secret-provider";

export class FakeSecretProvider implements ISecretProvider {
  constructor(private readonly values: Record<string, string> = {}) {}

  get(name: string): string | null {
    return this.values[name] || null;
  }
}
