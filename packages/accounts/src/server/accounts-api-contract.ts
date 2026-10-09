/**
 * accounts の GAS エンドポイント契約(唯一の正準定義)。
 *
 * クライアント(client/model/accounts-repository.ts)とサーバー(server/endpoints.ts)の
 * 両方がここから型を参照する。エンドポイント名一覧は infrastructures/gas の
 * esbuild banner/footer コード生成、および scripts/gas-contract.js の集約対象になる。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";

export const ACCOUNTS_PREFIX = "accounts" as const;

export const ACCOUNTS_ENDPOINTS = [
  "listMembers",
  "listAccounts",
  "addMember",
  "updateMember",
  "deleteMember",
  "replaceAllMembers",
  "setPassword",
  "login",
  "logout",
  "getSession",
] as const;

export type AccountsEndpointName = (typeof ACCOUNTS_ENDPOINTS)[number];

export type AccountsFunctionName =
  `${typeof ACCOUNTS_PREFIX}_${AccountsEndpointName}`;

/**
 * app-scheduler本体・各ゲームパッケージが共有するメンバーマスタ。id/name のみを
 * 共通項として持ち、モジュール固有の追加設定(例: game-jackpotのrank/写真、
 * game-quizのログイン可否)は各モジュール側で id をキーに個別管理する。
 */
export interface Member {
  id: string;
  name: string;
  /** 管理画面を操作できるか。未設定は管理者ではない。 */
  isAdmin?: boolean;
  /** パスワードが設定済みか(listAccountsの結果にのみ付く。ハッシュ自体は返さない)。 */
  hasPassword?: boolean;
}

export type ListMembersArgs = Record<string, never>;

export interface AddMemberArgs {
  /**
   * 省略時はサーバー側で自動採番する。呼び出し側が人間の入力しやすいID
   * (例: game-quizのログインID)を指定したい場合は明示的に渡す。
   */
  id?: string;
  name: string;
  isAdmin?: boolean;
}

/** isAdmin を省略した場合は既存の値を保つ。 */
export interface UpdateMemberArgs {
  id: string;
  name: string;
  isAdmin?: boolean;
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

export interface SetPasswordArgs {
  id: string;
  password: string;
}

export interface LoginArgs {
  id: string;
  password: string;
}

export interface LoginResult {
  token: string;
  member: Member;
}

export interface LogoutArgs {
  token: string;
}

export interface GetSessionArgs {
  token: string;
}

/**
 * クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` で生成される
 * Proxyの型として使う。
 */
export interface AccountsApi {
  /** 表示用の名簿(id/name のみ)。 */
  listMembers(args: ListMembersArgs, options?: ApiCallOptions): Promise<Member[]>;
  /** 管理者向け一覧(isAdmin / hasPassword 付き)。 */
  listAccounts(args: ListMembersArgs, options?: ApiCallOptions): Promise<Member[]>;
  addMember(args: AddMemberArgs, options?: ApiCallOptions): Promise<Member>;
  updateMember(args: UpdateMemberArgs, options?: ApiCallOptions): Promise<Member>;
  deleteMember(args: DeleteMemberArgs, options?: ApiCallOptions): Promise<void>;
  replaceAllMembers(
    args: ReplaceAllMembersArgs,
    options?: ApiCallOptions
  ): Promise<ReplaceAllMembersResult>;
  setPassword(args: SetPasswordArgs, options?: ApiCallOptions): Promise<void>;
  login(args: LoginArgs, options?: ApiCallOptions): Promise<LoginResult>;
  logout(args: LogoutArgs, options?: ApiCallOptions): Promise<void>;
  /** トークンが有効ならそのメンバー、無効/期限切れなら null。 */
  getSession(args: GetSessionArgs, options?: ApiCallOptions): Promise<Member | null>;
}

/** `AccountsApi` をDI解決するためのトークン。 */
export const IAccountsApiToken = Symbol("IAccountsApi");
