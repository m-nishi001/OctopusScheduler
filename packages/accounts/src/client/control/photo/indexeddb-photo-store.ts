import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import type { MemberPhotoStore } from "./member-photo-cache";

/** 顔写真の端末内保存(IndexedDB)。キーは中身のハッシュで、中身は変わらないので、更新も削除もしない。 */
export class IndexedDbPhotoStore implements MemberPhotoStore {
  private readonly storage = new LocalStorageService("octopus-cache", "member-photos");

  get(hash: string): Promise<string | undefined> {
    return this.storage.get<string>(hash);
  }

  save(hash: string, dataUrl: string): Promise<void> {
    return this.storage.save(hash, dataUrl);
  }
}
