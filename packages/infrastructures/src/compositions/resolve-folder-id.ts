/**
 * アセット/JSON保存先の名前空間(旧 folderId)解決ロジック。
 *
 * `octopus-scheduler` はクライアント指定の値を無視して常にプロパティを使うのに対し、
 * `jackpot-game`/`quiz-game` はクライアント指定を優先する、という非対称なポリシーが既存挙動として
 * あるため、2つの関数として分けて残す(1つに統合しない)。
 */
import type { IKeyValueStorage } from "../interfaces/key-value-storage";

export interface FolderResolverDeps {
  kv: IKeyValueStorage;
}

async function resolve(
  deps: FolderResolverDeps,
  propertyKey: string,
  providedFolderId: string | undefined
): Promise<string> {
  const folderId = providedFolderId || (await deps.kv.get(propertyKey)) || "";
  if (!folderId) {
    throw new Error(
      `ScriptProperties '${propertyKey}' is not configured and no parentFolderId was provided.`
    );
  }
  return folderId;
}

/** クライアント指定の値を無視し、常にプロパティから解決する。 */
export async function resolveFolderIdIgnoringProvided(
  deps: FolderResolverDeps,
  propertyKey: string
): Promise<string> {
  return resolve(deps, propertyKey, undefined);
}

/** クライアント指定の値があれば優先し、無ければプロパティから解決する。 */
export async function resolveFolderIdPreferringProvided(
  deps: FolderResolverDeps,
  propertyKey: string,
  providedFolderId?: string
): Promise<string> {
  return resolve(deps, propertyKey, providedFolderId);
}
