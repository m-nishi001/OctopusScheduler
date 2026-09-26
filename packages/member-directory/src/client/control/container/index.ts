import { container, instanceCachingFactory } from "tsyringe";
import { IApiClientToken, createTypedApiClient } from "@octopus/infrastructures/interfaces";
import { GasApiClient } from "@octopus/infrastructures/gas/gas-api-client";
import {
  MEMBER_DIRECTORY_PREFIX,
  MEMBER_DIRECTORY_ENDPOINTS,
  IMemberDirectoryApiToken,
} from "../../../server/member-directory-api-contract";
import type { MemberDirectoryApi } from "../../../server/member-directory-api-contract";
import { MemberDirectoryRepository } from "../../model/member-directory-repository";

export class Container {
  static register() {
    // GAS 用のインフラを登録する。将来 Cloudflare 等に切り替える場合は
    // ここを設定に応じて別実装(CloudflareApiClient 等)に差し替えるだけでよい。
    container.register(IApiClientToken, { useClass: GasApiClient });
    container.register<MemberDirectoryApi>(IMemberDirectoryApiToken, {
      useFactory: instanceCachingFactory((c) =>
        createTypedApiClient<MemberDirectoryApi>(
          c.resolve(IApiClientToken),
          MEMBER_DIRECTORY_PREFIX,
          MEMBER_DIRECTORY_ENDPOINTS
        )
      ),
    });

    container.register(MemberDirectoryRepository, { useClass: MemberDirectoryRepository });
  }
}
