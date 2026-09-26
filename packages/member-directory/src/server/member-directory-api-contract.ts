/**
 * member-directory の GAS エンドポイント契約(唯一の正準定義)。
 *
 * クライアント(client/model/member-directory-repository.ts)とサーバー(server/endpoints.ts)の
 * 両方がここから型を参照する。エンドポイント名一覧は infrastructures/gas の
 * esbuild banner/footer コード生成、および scripts/gas-contract.js の集約対象になる。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";

export const MEMBER_DIRECTORY_PREFIX = "memberDirectory" as const;

export const MEMBER_DIRECTORY_ENDPOINTS = [
  "listMembers",
  "addMember",
  "updateMember",
  "deleteMember",
  "replaceAllMembers",
] as const;

export type MemberDirectoryEndpointName = (typeof MEMBER_DIRECTORY_ENDPOINTS)[number];

export type MemberDirectoryFunctionName =
  `${typeof MEMBER_DIRECTORY_PREFIX}_${MemberDirectoryEndpointName}`;

/**
 * app-scheduler本体・各ゲームパッケージが共有するメンバーマスタ。id/name のみを
 * 共通項として持ち、モジュール固有の追加設定(例: game-jackpotのrank/写真、
 * game-quizのログイン可否)は各モジュール側で id をキーに個別管理する。
 */
export interface Member {
  id: string;
  name: string;
}

export type ListMembersArgs = Record<string, never>;

export interface AddMemberArgs {
  /**
   * 省略時はサーバー側で自動採番する。呼び出し側が人間の入力しやすいID
   * (例: game-quizのログインID)を指定したい場合は明示的に渡す。
   */
  id?: string;
  name: string;
}

export interface UpdateMemberArgs {
  id: string;
  name: string;
}

export interface DeleteMemberArgs {
  id: string;
}

export interface ReplaceAllMembersArgs {
  members: Member[];
}

export interface ReplaceAllMembersResult {
  replaced: number;
}

/**
 * クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` で生成される
 * Proxyの型として使う。
 */
export interface MemberDirectoryApi {
  listMembers(args: ListMembersArgs, options?: ApiCallOptions): Promise<Member[]>;
  addMember(args: AddMemberArgs, options?: ApiCallOptions): Promise<Member>;
  updateMember(args: UpdateMemberArgs, options?: ApiCallOptions): Promise<Member>;
  deleteMember(args: DeleteMemberArgs, options?: ApiCallOptions): Promise<void>;
  replaceAllMembers(
    args: ReplaceAllMembersArgs,
    options?: ApiCallOptions
  ): Promise<ReplaceAllMembersResult>;
}

/** `MemberDirectoryApi` をDI解決するためのトークン。 */
export const IMemberDirectoryApiToken = Symbol("IMemberDirectoryApi");
