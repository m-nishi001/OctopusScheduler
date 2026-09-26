/**
 * interfaces/ の各トークンを Cloudflare 実装へ登録する。
 * GAS版の gas/container.ts と対になるファイル。ビルド対象(GAS/Cloudflare)に
 * 応じて、どちらか一方だけが読み込まれる。
 *
 * IApiClientToken はここでは登録しない。ブラウザ側(CloudflareApiClient)は
 * Vite の resolve.conditions で別途解決され、Worker自身が自分自身に
 * fetchで問い合わせることはないため。
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { IKeyValueStorageToken, ICacheToken, DataBaseFactoryToken, IUuidGeneratorToken, ILockToken } from "../interfaces";
import { CloudflareKeyValueStorage } from "./cloudflare-key-value-storage";
import { CloudflareCache } from "./cloudflare-cache";
import { createCloudflareDataBase } from "./cloudflare-database";
import { CloudflareUuidGenerator } from "./cloudflare-uuid-generator";
import { CloudflareLock } from "./cloudflare-lock";

export function registerCloudflareInfrastructures(): void {
  container.register(IKeyValueStorageToken, { useClass: CloudflareKeyValueStorage });
  container.register(ICacheToken, { useClass: CloudflareCache });
  container.register(DataBaseFactoryToken, { useValue: createCloudflareDataBase });
  container.register(IUuidGeneratorToken, { useClass: CloudflareUuidGenerator });
  container.register(ILockToken, { useClass: CloudflareLock });
}
