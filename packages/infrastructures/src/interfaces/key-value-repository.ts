/**
 * 単純なキー/値ストアの抽象化(GASでは PropertiesService)。
 */
export interface IKeyValueRepository {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const IKeyValueRepositoryToken = Symbol("IKeyValueRepository");
