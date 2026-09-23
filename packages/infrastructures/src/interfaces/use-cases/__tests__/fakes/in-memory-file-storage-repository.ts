import type {
  IFileStorageRepository,
  StoredFileMeta,
  StoredFileContent,
} from "../../../file-storage-repository";

interface StoredFile extends StoredFileMeta {
  mimeType: string;
  contentBase64: string;
  trashed: boolean;
}

export class InMemoryFileStorageRepository implements IFileStorageRepository {
  private readonly files = new Map<string, StoredFile>();
  private counter = 0;

  private nextId(): string {
    this.counter += 1;
    return `fake-file-${this.counter}`;
  }

  createFile(params: {
    folderId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }): StoredFileMeta {
    const fileId = this.nextId();
    const now = new Date().toISOString();
    const file: StoredFile = {
      fileId,
      fileName: params.fileName,
      parentFolderId: params.folderId,
      lastUpdate: now,
      createdDate: now,
      mimeType: params.mimeType,
      contentBase64: params.contentBase64,
      trashed: false,
    };
    this.files.set(fileId, file);
    return { ...file };
  }

  getFileById(fileId: string): StoredFileContent | null {
    const file = this.files.get(fileId);
    if (!file) return null;
    return {
      meta: { ...file },
      mimeType: file.mimeType,
      contentBase64: file.contentBase64,
    };
  }

  getFileContentAsText(fileId: string): string | null {
    const file = this.files.get(fileId);
    if (!file) return null;
    return Buffer.from(file.contentBase64, "base64").toString("utf8");
  }

  findFileByNamePrefix(folderId: string, prefix: string): StoredFileMeta | null {
    for (const file of this.files.values()) {
      if (!file.trashed && file.parentFolderId === folderId && file.fileName.startsWith(prefix)) {
        return { ...file };
      }
    }
    return null;
  }

  findFileByExactName(folderId: string, fileName: string): StoredFileMeta | null {
    for (const file of this.files.values()) {
      if (!file.trashed && file.parentFolderId === folderId && file.fileName === fileName) {
        return { ...file };
      }
    }
    return null;
  }

  listFilesRecursive(folderId: string): StoredFileMeta[] {
    return Array.from(this.files.values())
      .filter((f) => !f.trashed && f.parentFolderId === folderId)
      .map((f) => ({ ...f }));
  }

  replaceFileContent(params: {
    fileId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }): void {
    const file = this.files.get(params.fileId);
    if (!file) throw new Error(`file not found: ${params.fileId}`);
    file.fileName = params.fileName;
    file.mimeType = params.mimeType;
    file.contentBase64 = params.contentBase64;
    file.lastUpdate = new Date().toISOString();
  }

  deleteFile(fileId: string): StoredFileMeta | null {
    const file = this.files.get(fileId);
    if (!file) return null;
    file.trashed = true;
    return { ...file };
  }
}
