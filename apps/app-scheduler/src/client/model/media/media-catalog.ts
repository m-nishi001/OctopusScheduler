import type { DriveMetadata } from "@octopus/infrastructures/compositions";
import { StorageKind, StorageModule, storageNamespace } from "@octopus/infrastructures/compositions";
import { classifyMedia, type MediaKind } from "./media-kind";

/** 管理端末の一覧に出す素材 1 件。 */
export interface CatalogItem {
  id: string;
  /** 表示名(拡張子つき)。サーバーが返さないときは id。 */
  name: string;
  kind: MediaKind;
  /** 素材置き場直下のサブフォルダ名。置き場直下なら空。 */
  folder: string;
}

const ROOT = storageNamespace(StorageModule.Scheduler, StorageKind.Assets);

/** 素材の置き場所(`parentFolderId`)から、サブフォルダ名を取り出す。置き場直下や、ほかの場所なら空。 */
export function folderOf(parentFolderId: string | undefined): string {
  const prefix = `${ROOT}/`;
  if (!parentFolderId?.startsWith(prefix)) return "";
  return parentFolderId.slice(prefix.length).split("/")[0];
}

/** サーバーの一覧(本体は取らない)から、管理端末の一覧を作る。名前順。 */
export function toCatalog(metas: readonly DriveMetadata[]): CatalogItem[] {
  return metas
    .filter((m) => m?.driveDataId)
    .map((m) => {
      const name = m.fileName?.trim() || m.driveDataId;
      return { id: m.driveDataId, name, kind: classifyMedia(undefined, m.fileName), folder: folderOf(m.parentFolderId) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** 画像が入っているサブフォルダの名前(スライドショーに使える)。名前順。 */
export function listFolders(items: readonly CatalogItem[]): string[] {
  return [...new Set(items.filter((i) => i.kind === "image" && i.folder).map((i) => i.folder))].sort((a, b) => a.localeCompare(b));
}
