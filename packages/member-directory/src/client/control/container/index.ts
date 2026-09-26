import { container, instanceCachingFactory } from "tsyringe";
import { IApiClientToken, createTypedApiClient } from "@octopus/infrastructures/interfaces";
import { PlatformApiClient } from "@octopus/infrastructures/platform-api-client";
import {
  MEMBER_DIRECTORY_PREFIX,
  MEMBER_DIRECTORY_ENDPOINTS,
  IMemberDirectoryApiToken,
} from "../../../server/member-directory-api-contract";
import type { MemberDirectoryApi } from "../../../server/member-directory-api-contract";
import { MemberDirectoryRepository } from "../../model/member-directory-repository";

export class Container {
  static register() {
    // ビルド対象(GAS/Cloudflare)ごとに @octopus/infrastructures/platform-api-client が
    // 解決する実装(Viteのresolve.conditions)を登録する。
    container.register(IApiClientToken, { useClass: PlatformApiClient });
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
