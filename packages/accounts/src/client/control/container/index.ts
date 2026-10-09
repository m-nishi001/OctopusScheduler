import { container, instanceCachingFactory } from "tsyringe";
import { IApiClientToken, createTypedApiClient } from "@octopus/infrastructures/interfaces";
import { PlatformApiClient } from "@octopus/infrastructures/platform-api-client";
import {
  ACCOUNTS_PREFIX,
  ACCOUNTS_ENDPOINTS,
  IAccountsApiToken,
} from "../../../server/accounts-api-contract";
import type { AccountsApi } from "../../../server/accounts-api-contract";
import { AccountsRepository } from "../../model/accounts-repository";

export class Container {
  static register() {
    // ビルド対象(GAS/Cloudflare)ごとに @octopus/infrastructures/platform-api-client が
    // 解決する実装(Viteのresolve.conditions)を登録する。
    container.register(IApiClientToken, { useClass: PlatformApiClient });
    container.register<AccountsApi>(IAccountsApiToken, {
      useFactory: instanceCachingFactory((c) =>
        createTypedApiClient<AccountsApi>(
          c.resolve(IApiClientToken),
          ACCOUNTS_PREFIX,
          ACCOUNTS_ENDPOINTS
        )
      ),
    });

    container.register(AccountsRepository, { useClass: AccountsRepository });
  }
}
