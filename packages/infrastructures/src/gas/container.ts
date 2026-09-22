/**
 * interfaces/ の各トークンを GAS 実装に登録する。
 *
 * 将来 Cloudflare 版を作る際は、同じトークンを Cloudflare 実装へ登録する
 * `cloudflare/container.ts` を追加し、ビルド対象に応じて読み込む方を切り替える。
 */
import "reflect-metadata";
import { container } from "tsyringe";
import {
  IApiClientToken,
  IFileStorageRepositoryToken,
  IKeyValueRepositoryToken,
  ICacheRepositoryToken,
  ILockRepositoryToken,
  IFormRepositoryToken,
  RecordStoreRepositoryFactoryToken,
} from "../interfaces";
import { GasApiClient } from "./gas-api-client";
import { GasFileStorageRepository } from "./gas-file-storage-repository";
import { GasKeyValueRepository } from "./gas-key-value-repository";
import { GasCacheRepository } from "./gas-cache-repository";
import { GasLockRepository } from "./gas-lock-repository";
import { GasFormRepository } from "./gas-form-repository";
import { createGasRecordStoreRepository } from "./gas-record-store-repository";

export function registerGasInfrastructures(): void {
  container.register(IApiClientToken, { useClass: GasApiClient });
  container.register(IFileStorageRepositoryToken, {
    useClass: GasFileStorageRepository,
  });
  container.register(IKeyValueRepositoryToken, {
    useClass: GasKeyValueRepository,
  });
  container.register(ICacheRepositoryToken, { useClass: GasCacheRepository });
  container.register(ILockRepositoryToken, { useClass: GasLockRepository });
  container.register(IFormRepositoryToken, { useClass: GasFormRepository });
  container.register(RecordStoreRepositoryFactoryToken, {
    useValue: createGasRecordStoreRepository,
  });
}
