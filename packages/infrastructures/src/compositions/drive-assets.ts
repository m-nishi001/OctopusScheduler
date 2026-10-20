/**
 * 素材(画像・音声・動画など)の保存・一覧・取得。scheduler / quiz / jackpot で共通。
 *
 * 保存先の「いまの状態」だけを見て決める。キャッシュなどの別の状態は持たない
 * (持つと、その状態とストレージがずれたときに、保存したつもりで保存されない不具合になる)。
 * 失敗は例外で呼び出し元へ伝える。成功のふりはしない。
 */
import type { IKeyValueStorage } from "../interfaces/key-value-storage";
import type { DriveData, DriveMetadata } from "./types";
import { getDriveData } from "./get-item-use-case";
import { getDriveMetadata } from "./get-item-metadata-use-case";
import {
  decodeItemId,
  encodeLocalName,
  extractBase64FromDataUrl,
  makeKey,
  splitKey,
  toDriveMetadata,
} from "./item-key-naming";
import {
  storageNamespace,
  storagePath,
  type StorageKindName,
  type StorageModuleName,
} from "./storage-paths";

export interface DriveAssetDeps {
  storage: IKeyValueStorage;
}

/**
 * 素材を保存する。追加も更新も同じ操作(同じ素材 ID なら上書き)。
 * 表示名が変わると保存先のキーも変わるので、新しい内容を書き込んでから、同じ素材の古いキーを消す
 * (途中で失敗しても、古い内容は残る)。保存先はクライアントの `parentFolderId` に関わらず `namespace` に固定する。
 *
 * @returns 保存した素材のメタデータ
 */
export async function saveDriveData(
  deps: DriveAssetDeps,
  namespace: string,
  driveData: DriveData
): Promise<DriveMetadata> {
  const itemId = driveData.metadata.driveDataId;
  const key = makeKey(namespace, encodeLocalName(itemId, driveData.fileName));
  const sameItemKeys = (await deps.storage.listByPrefix(`${namespace}/${itemId}_`))
    .map((meta) => meta.key)
    .filter((existing) => decodeItemId(splitKey(existing).localName) === itemId);

  const meta = await deps.storage.putBinary(
    key,
    extractBase64FromDataUrl(driveData.fileDataUrl || ""),
    driveData.fileKind
  );
  for (const old of sameItemKeys) {
    if (old !== key) await deps.storage.delete(old);
  }
  return toDriveMetadata(meta, itemId);
}

/**
 * あるモジュールの素材置き場(`<module>/<kind>`)に対する操作の組。
 * 各ゲームのエンドポイントは、これを1つ作って呼ぶだけにする。
 */
export function createDriveAssets(module: StorageModuleName, kind: StorageKindName) {
  const namespace = storageNamespace(module, kind);
  return {
    /** 素材を追加または更新する。{@link saveDriveData} */
    save: (deps: DriveAssetDeps, driveData: DriveData): Promise<DriveMetadata> =>
      saveDriveData(deps, namespace, driveData),

    /**
     * 素材の一覧。`folderName` を渡すと置き場直下のサブフォルダ1階層を一覧する(省略時は置き場直下)。
     * `folderName` が1階層のパス要素でなければ例外。
     */
    listMetadata: async (deps: DriveAssetDeps, folderName?: string): Promise<DriveMetadata[]> => {
      const name = folderName?.trim();
      return getDriveMetadata(deps, name ? storagePath(module, kind, name) : namespace);
    },

    /** 素材 1 件(内容つき)。無ければ null。`storageRef` は一覧のメタデータの `fileId`。 */
    get: (deps: DriveAssetDeps, storageRef: string): Promise<DriveData | null> =>
      getDriveData(deps, storageRef),
  };
}
