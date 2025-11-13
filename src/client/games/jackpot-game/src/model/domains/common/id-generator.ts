export const IdGeneratorToken = "IdGenerator";

export interface IdGenerator {
  nextId(): string;
}
