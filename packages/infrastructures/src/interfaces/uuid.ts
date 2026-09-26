export interface IUuidGenerator {
  generate(): string;
}

export const IUuidGeneratorToken = Symbol("IUuidGenerator");
