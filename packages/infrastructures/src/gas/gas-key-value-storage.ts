import { injectable } from "tsyringe";
import type {
  IKeyValueStorage,
  StoredItemContent,
  StoredItemMeta,
} from "../interfaces/key-value-storage";

/**
 * IKeyValueStorage の GAS 実装。
 *
 * 単純な文字列値(get/set)は PropertiesService、内容付きの値(putText, putBinary,
 * getContent, getContentAsText, stat, listByPrefix, delete)は DriveApp に委譲する。
 * 内容付きの値のキーは呼び出し側の規約により常に `"<folderId>/<localName>"` の
 * 形をしており、folderId 部分を Drive フォルダIDとして解釈する。
 */
@injectable()
export class GasKeyValueStorage implements IKeyValueStorage {
  get(key: string): string | null {
    return PropertiesService.getScriptProperties().getProperty(key);
  }

  set(key: string, value: string): void {
    PropertiesService.getScriptProperties().setProperty(key, value);
  }

  private splitKey(key: string): { namespace: string; localName: string } {
    const idx = key.indexOf("/");
    if (idx === -1) {
      throw new Error(`Invalid storage key (missing "<namespace>/" prefix): ${key}`);
    }
    return { namespace: key.slice(0, idx), localName: key.slice(idx + 1) };
  }

  private toMeta(
    file: GoogleAppsScript.Drive.File,
    namespace: string,
    localName: string
  ): StoredItemMeta {
    return {
      key: `${namespace}/${localName}`,
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
    const { namespace, localName } = this.splitKey(key);
    const folder = DriveApp.getFolderById(namespace);
    const existing = folder.getFilesByName(localName);
    if (existing.hasNext()) {
      existing.next().setTrashed(true);
    }
    const file = folder.createFile(blob);
    file.setName(localName);
    return this.toMeta(file, namespace, localName);
  }

  putText(key: string, content: string, mimeType: string): StoredItemMeta {
    const { localName } = this.splitKey(key);
    return this.upsert(key, Utilities.newBlob(content, mimeType, localName));
  }

  putBinary(key: string, contentBase64: string, mimeType: string): StoredItemMeta {
    const { localName } = this.splitKey(key);
    const bytes = Utilities.base64Decode(contentBase64);
    return this.upsert(key, Utilities.newBlob(bytes, mimeType, localName));
  }

  getContent(key: string): StoredItemContent | null {
    try {
      const { namespace, localName } = this.splitKey(key);
      const files = DriveApp.getFolderById(namespace).getFilesByName(localName);
      if (!files.hasNext()) return null;
      const file = files.next();
      return {
        meta: this.toMeta(file, namespace, localName),
        contentBase64: Utilities.base64Encode(file.getBlob().getBytes()),
      };
    } catch {
      return null;
    }
  }

  getContentAsText(key: string): string | null {
    try {
      const { namespace, localName } = this.splitKey(key);
      const files = DriveApp.getFolderById(namespace).getFilesByName(localName);
      if (!files.hasNext()) return null;
      return files.next().getBlob().getDataAsString();
    } catch {
      return null;
    }
  }

  stat(key: string): StoredItemMeta | null {
    try {
      const { namespace, localName } = this.splitKey(key);
      const files = DriveApp.getFolderById(namespace).getFilesByName(localName);
      if (!files.hasNext()) return null;
      return this.toMeta(files.next(), namespace, localName);
    } catch {
      return null;
    }
  }

  listByPrefix(prefix: string): StoredItemMeta[] {
    const idx = prefix.indexOf("/");
    const namespace = idx === -1 ? prefix : prefix.slice(0, idx);
    const localPrefix = idx === -1 ? "" : prefix.slice(idx + 1);
    return this.walk(DriveApp.getFolderById(namespace), namespace, localPrefix);
  }

  // 旧 listFilesRecursive のサブフォルダ再帰走査を維持する。キーは常に最上位の
  // namespace を使う(サブフォルダのIDをキーに含めない)ため、呼び出し側から見た
  // フラットなキー空間という前提は、人手でサブフォルダを作っていても崩れない。
  private walk(
    folder: GoogleAppsScript.Drive.Folder,
    namespace: string,
    localPrefix: string
  ): StoredItemMeta[] {
    const out: StoredItemMeta[] = [];
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (!localPrefix || file.getName().startsWith(localPrefix)) {
        out.push(this.toMeta(file, namespace, file.getName()));
      }
    }
    const subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      out.push(...this.walk(subFolders.next(), namespace, localPrefix));
    }
    return out;
  }

  delete(key: string): StoredItemMeta | null {
    try {
      const { namespace, localName } = this.splitKey(key);
      const files = DriveApp.getFolderById(namespace).getFilesByName(localName);
      if (!files.hasNext()) return null;
      const file = files.next();
      const meta = this.toMeta(file, namespace, localName);
      file.setTrashed(true);
      return meta;
    } catch {
      return null;
    }
  }
}
