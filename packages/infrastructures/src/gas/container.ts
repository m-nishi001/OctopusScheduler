/**
 * interfaces/ の各トークンを GAS 実装に登録する。
 *
 * 将来 Cloudflare 版を作る際は、同じトークンを Cloudflare 実装へ登録する
 * `cloudflare/container.ts` を追加し、ビルド対象に応じて読み込む方を切り替える。
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { IApiClientToken, IKeyValueStorageToken, ICacheToken, DataBaseFactoryToken } from "../interfaces";
import { GasApiClient } from "./gas-api-client";
import { GasKeyValueStorage } from "./gas-key-value-storage";
import { GasCache } from "./gas-cache";
import { GasFormRepository } from "./gas-form-repository";
import { createGasDataBase } from "./gas-database";

export function registerGasInfrastructures(): void {
  container.register(IApiClientToken, { useClass: GasApiClient });
  container.register(IKeyValueStorageToken, { useClass: GasKeyValueStorage });
  container.register(ICacheToken, { useClass: GasCache });
  container.register(DataBaseFactoryToken, { useValue: createGasDataBase });
  container.registerSingleton(GasFormRepository);
}
