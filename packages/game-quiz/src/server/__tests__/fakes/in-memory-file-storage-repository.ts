import type {
  IFileStorageRepository,
  StoredFileMeta,
  StoredFileContent,
} from "@octopus/infrastructures/interfaces";

interface StoredFile extends StoredFileMeta {
  mimeType: string;
  contentBase64: string;
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
    return this.store(params.folderId, params.fileName, params.mimeType, params.contentBase64);
  }

  createTextFile(params: {
    folderId: string;
    fileName: string;
    mimeType: string;
    content: string;
  }): StoredFileMeta {
    return this.store(
      params.folderId,
      params.fileName,
      params.mimeType,
      Buffer.from(params.content, "utf8").toString("base64")
    );
  }

  private store(
    folderId: string,
    fileName: string,
    mimeType: string,
    contentBase64: string
  ): StoredFileMeta {
    const fileId = this.nextId();
    const now = new Date().toISOString();
    const file: StoredFile = {
      fileId,
      fileName,
      parentFolderId: folderId,
      lastUpdate: now,
      createdDate: now,
      mimeType,
      contentBase64,
    };
    this.files.set(fileId, file);
    return { ...file };
  }

  getFileById(fileId: string): StoredFileContent | null {
    const file = this.files.get(fileId);
    if (!file) return null;
    return { meta: { ...file }, mimeType: file.mimeType, contentBase64: file.contentBase64 };
  }

  getFileContentAsText(fileId: string): string | null {
    const file = this.files.get(fileId);
    if (!file) return null;
    return Buffer.from(file.contentBase64, "base64").toString("utf8");
  }

  findFileByNamePrefix(folderId: string, prefix: string): StoredFileMeta | null {
    for (const file of this.files.values()) {
      if (file.parentFolderId === folderId && file.fileName.startsWith(prefix)) {
        return { ...file };
      }
    }
    return null;
  }

  findFileByExactName(folderId: string, fileName: string): StoredFileMeta | null {
    for (const file of this.files.values()) {
      if (file.parentFolderId === folderId && file.fileName === fileName) {
        return { ...file };
      }
    }
    return null;
  }

  listFilesRecursive(folderId: string): StoredFileMeta[] {
    return Array.from(this.files.values())
      .filter((f) => f.parentFolderId === folderId)
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
  }

  deleteFile(fileId: string): StoredFileMeta | null {
    const file = this.files.get(fileId);
    if (!file) return null;
    this.files.delete(fileId);
    return { ...file };
  }
}
