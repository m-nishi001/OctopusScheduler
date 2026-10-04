import { injectable } from "tsyringe";
import {
  StorageNotConfiguredError,
  type IKeyValueStorage,
  type StoredItemContent,
  type StoredItemMeta,
} from "../interfaces/key-value-storage";

/** 保存先ルートとなる Drive フォルダIDを登録する ScriptProperty のキー。 */
export const ROOT_FOLDER_PROPERTY_KEY = "OCTOPUS_ROOT_FOLDER_ID";

/**
 * IKeyValueStorage の GAS 実装。
 *
 * 単純な文字列値(get/set)は PropertiesService、内容付きの値(putText, putBinary,
 * getContent, getContentAsText, stat, listByPrefix, delete)は DriveApp に委譲する。
 * 内容付きの値のキーはルート相対の論理パス `"<dir>/.../<localName>"`
 * (組み立ては compositions/storage-paths.ts)で、ScriptProperty
 * `OCTOPUS_ROOT_FOLDER_ID` のフォルダ配下のサブフォルダ階層にそのまま対応する
 * (書き込み時にサブフォルダは自動作成する)。ルート未設定は
 * StorageNotConfiguredError を投げる。
 */
@injectable()
export class GasKeyValueStorage implements IKeyValueStorage {
  async get(key: string): Promise<string | null> {
    return PropertiesService.getScriptProperties().getProperty(key);
  }

  async set(key: string, value: string): Promise<void> {
    PropertiesService.getScriptProperties().setProperty(key, value);
  }

  /** ルートフォルダを返す。未設定・参照不能なら StorageNotConfiguredError。 */
  private rootFolder(): GoogleAppsScript.Drive.Folder {
    const id = PropertiesService.getScriptProperties().getProperty(ROOT_FOLDER_PROPERTY_KEY);
    if (!id) {
      throw new StorageNotConfiguredError(
        `ScriptProperties '${ROOT_FOLDER_PROPERTY_KEY}' is not configured. ` +
          "Set it to the ID of the Google Drive folder used as the storage root."
      );
    }
    try {
      return DriveApp.getFolderById(id);
    } catch {
      throw new StorageNotConfiguredError(
        `ScriptProperties '${ROOT_FOLDER_PROPERTY_KEY}' ('${id}') does not point to an accessible Drive folder.`
      );
    }
  }

  private splitKey(key: string): { dir: string; localName: string } {
    const idx = key.lastIndexOf("/");
    if (idx === -1) {
      throw new Error(`Invalid storage key (missing "<dir>/" prefix): ${key}`);
    }
    return { dir: key.slice(0, idx), localName: key.slice(idx + 1) };
  }

  /** root から dir を辿る。create=false で存在しない場合は null。 */
  private resolveDir(
    dir: string,
    create: boolean
  ): GoogleAppsScript.Drive.Folder | null {
    let folder = this.rootFolder();
    for (const name of dir.split("/")) {
      const children = folder.getFoldersByName(name);
      if (children.hasNext()) {
        folder = children.next();
      } else if (create) {
        folder = folder.createFolder(name);
      } else {
        return null;
      }
    }
    return folder;
  }

  private toMeta(
    file: GoogleAppsScript.Drive.File,
    dir: string,
    localName: string
  ): StoredItemMeta {
    return {
      key: `${dir}/${localName}`,
      mimeType: file.getMimeType() || "application/octet-stream",
      size: file.getSize(),
      createdAt: new Date(file.getDateCreated().getTime()).toISOString(),
      updatedAt: new Date(file.getLastUpdated().getTime()).toISOString(),
    };
  }

  private upsert(
    key: string,
    blob: GoogleAppsScript.Base.Blob
  ): StoredItemMeta {
    const { dir, localName } = this.splitKey(key);
    const folder = this.resolveDir(dir, true)!;
    const existing = folder.getFilesByName(localName);
    if (existing.hasNext()) {
      existing.next().setTrashed(true);
    }
    const file = folder.createFile(blob);
    file.setName(localName);
    return this.toMeta(file, dir, localName);
  }

  /** key のファイルを探す。ルート未設定は例外、それ以外の失敗は null。 */
  private findFile(
    key: string
  ): { file: GoogleAppsScript.Drive.File; dir: string; localName: string } | null {
    const { dir, localName } = this.splitKey(key);
    try {
      const folder = this.resolveDir(dir, false);
      if (!folder) return null;
      const files = folder.getFilesByName(localName);
      if (!files.hasNext()) return null;
      return { file: files.next(), dir, localName };
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) throw error;
      return null;
    }
  }

  async putText(key: string, content: string, mimeType: string): Promise<StoredItemMeta> {
    const { localName } = this.splitKey(key);
    return this.upsert(key, Utilities.newBlob(content, mimeType, localName));
  }

  async putBinary(key: string, contentBase64: string, mimeType: string): Promise<StoredItemMeta> {
    const { localName } = this.splitKey(key);
    const bytes = Utilities.base64Decode(contentBase64);
    return this.upsert(key, Utilities.newBlob(bytes, mimeType, localName));
  }

  async getContent(key: string): Promise<StoredItemContent | null> {
    const found = this.findFile(key);
    if (!found) return null;
    return {
      meta: this.toMeta(found.file, found.dir, found.localName),
      contentBase64: Utilities.base64Encode(found.file.getBlob().getBytes()),
    };
  }

  async getContentAsText(key: string): Promise<string | null> {
    const found = this.findFile(key);
    return found ? found.file.getBlob().getDataAsString() : null;
  }

  async stat(key: string): Promise<StoredItemMeta | null> {
    const found = this.findFile(key);
    return found ? this.toMeta(found.file, found.dir, found.localName) : null;
  }

  // prefix は `<dir>/<localPrefix>` 形式。dir 直下のファイルだけを対象にする
  // (パスと1対1に対応させるため、サブフォルダは再帰しない)。
  async listByPrefix(prefix: string): Promise<StoredItemMeta[]> {
    const { dir, localName: localPrefix } = this.splitKey(prefix);
    const folder = this.resolveDir(dir, false);
    if (!folder) return [];
    const out: StoredItemMeta[] = [];
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (!localPrefix || file.getName().startsWith(localPrefix)) {
        out.push(this.toMeta(file, dir, file.getName()));
      }
    }
    return out;
  }

  async delete(key: string): Promise<StoredItemMeta | null> {
    const found = this.findFile(key);
    if (!found) return null;
    const meta = this.toMeta(found.file, found.dir, found.localName);
    found.file.setTrashed(true);
    return meta;
  }
}
