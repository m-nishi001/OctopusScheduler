import { injectable } from "tsyringe";
import type {
  IFileStorageRepository,
  StoredFileMeta,
  StoredFileContent,
} from "../interfaces/file-storage-repository";

function toMeta(
  file: GoogleAppsScript.Drive.File,
  parentFolderId?: string
): StoredFileMeta {
  const parent =
    parentFolderId ??
    (file.getParents().hasNext() ? file.getParents().next().getId() : "");
  return {
    fileId: file.getId(),
    fileName: file.getName(),
    parentFolderId: parent,
    lastUpdate: new Date(file.getLastUpdated().getTime()).toISOString(),
    createdDate: new Date(file.getDateCreated().getTime()).toISOString(),
    size: file.getSize(),
  };
}

@injectable()
export class GasFileStorageRepository implements IFileStorageRepository {
  createFile(params: {
    folderId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }): StoredFileMeta {
    const bytes = Utilities.base64Decode(params.contentBase64);
    const blob = Utilities.newBlob(bytes, params.mimeType, params.fileName);
    const folder = DriveApp.getFolderById(params.folderId);
    const file = folder.createFile(blob);
    file.setName(params.fileName);
    return toMeta(file, params.folderId);
  }

  createTextFile(params: {
    folderId: string;
    fileName: string;
    mimeType: string;
    content: string;
  }): StoredFileMeta {
    const blob = Utilities.newBlob(params.content, params.mimeType, params.fileName);
    const folder = DriveApp.getFolderById(params.folderId);
    const file = folder.createFile(blob);
    file.setName(params.fileName);
    return toMeta(file, params.folderId);
  }

  getFileById(fileId: string): StoredFileContent | null {
    try {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      return {
        meta: toMeta(file),
        mimeType: file.getMimeType() || "application/octet-stream",
        contentBase64: Utilities.base64Encode(blob.getBytes()),
      };
    } catch {
      return null;
    }
  }

  getFileContentAsText(fileId: string): string | null {
    try {
      const file = DriveApp.getFileById(fileId);
      return file.getBlob().getDataAsString();
    } catch {
      return null;
    }
  }

  findFileByNamePrefix(folderId: string, prefix: string): StoredFileMeta | null {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().startsWith(prefix)) {
        return toMeta(file, folderId);
      }
    }
    return null;
  }

  findFileByExactName(folderId: string, fileName: string): StoredFileMeta | null {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName(fileName);
    if (!files.hasNext()) return null;
    return toMeta(files.next(), folderId);
  }

  listFilesRecursive(folderId: string): StoredFileMeta[] {
    const folder = DriveApp.getFolderById(folderId);
    const metadata: StoredFileMeta[] = [];

    const files = folder.getFiles();
    while (files.hasNext()) {
      metadata.push(toMeta(files.next(), folderId));
    }

    const subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      const subFolder = subFolders.next();
      metadata.push(...this.listFilesRecursive(subFolder.getId()));
    }

    return metadata;
  }

  replaceFileContent(params: {
    fileId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }): void {
    const file = DriveApp.getFileById(params.fileId);
    const bytes = Utilities.base64Decode(params.contentBase64);
    const blob = Utilities.newBlob(bytes, params.mimeType, params.fileName);
    const parent = file.getParents().hasNext() ? file.getParents().next() : null;

    // 既存の GoogleDriveService と同じ順序で処理する(親フォルダが無い場合、
    // ゴミ箱に移動済みの file に対して setContent/setName する点も含めて保持)。
    file.setTrashed(true);
    if (parent) {
      const newFile = parent.createFile(blob);
      newFile.setName(params.fileName);
    } else {
      file.setContent(blob.getDataAsString());
      file.setName(params.fileName);
    }
  }

  deleteFile(fileId: string): StoredFileMeta | null {
    try {
      const file = DriveApp.getFileById(fileId);
      const meta = toMeta(file);
      file.setTrashed(true);
      return meta;
    } catch {
      return null;
    }
  }
}
