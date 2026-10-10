/**
 * accounts の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case呼び出し -> ApiResponseに詰めてJSON.stringify」
 * という薄い層のみを担う。マスタメンバーデータは app-scheduler本体・各ゲームパッケージ
 * から共有される単一の名簿として IKeyValueStorage に保存する。
 */
import { errorResponse } from "@octopus/infrastructures/interfaces";
import { container } from "tsyringe";
import { IKeyValueStorageToken, IPasswordHasherToken, IUuidGeneratorToken } from "@octopus/infrastructures/interfaces";
import type { IKeyValueStorage, IPasswordHasher, IUuidGenerator } from "@octopus/infrastructures/interfaces";
import type {
  AddMemberArgs,
  DeleteMemberArgs,
  GetSessionArgs,
  ListMembersArgs,
  LoginArgs,
  LogoutArgs,
  AccountsEndpointName,
  ReplaceAllMembersArgs,
  SetPasswordArgs,
  UpdateMemberArgs,
} from "./accounts-api-contract";
import { ACCOUNTS_PREFIX } from "./accounts-api-contract";
import { secure } from "./secure";
import {
  addMember,
  deleteMember,
  getSession,
  InvalidCredentialsError,
  listAccounts,
  listMembers,
  login,
  logout,
  replaceAllMembers,
  setPassword,
  updateMember,
} from "./accounts-use-cases";

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    generateId: (): string => container.resolve<IUuidGenerator>(IUuidGeneratorToken).generate(),
    hasher: container.resolve<IPasswordHasher>(IPasswordHasherToken),
    now: (): number => Date.now(),
  };
}

declare let _accounts_listAccounts: (args: ListMembersArgs) => Promise<string>;
declare let _accounts_listMembers: (args: ListMembersArgs) => Promise<string>;
declare let _accounts_addMember: (args: AddMemberArgs) => Promise<string>;
declare let _accounts_updateMember: (args: UpdateMemberArgs) => Promise<string>;
declare let _accounts_deleteMember: (args: DeleteMemberArgs) => Promise<string>;
declare let _accounts_replaceAllMembers: (args: ReplaceAllMembersArgs) => Promise<string>;
declare let _accounts_setPassword: (args: SetPasswordArgs) => Promise<string>;
declare let _accounts_login: (args: LoginArgs) => Promise<string>;
declare let _accounts_logout: (args: LogoutArgs) => Promise<string>;
declare let _accounts_getSession: (args: GetSessionArgs) => Promise<string>;

_accounts_listMembers = async (_args: ListMembersArgs): Promise<string> => {
  try {
    const result = await listMembers(resolveDeps());
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return errorResponse(error);
  }
};

_accounts_listAccounts = async (_args: ListMembersArgs): Promise<string> => {
  try {
    const result = await listAccounts(resolveDeps());
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return errorResponse(error);
  }
};

_accounts_addMember = async (args: AddMemberArgs): Promise<string> => {
  try {
    const result = await addMember(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return errorResponse(error);
  }
};

_accounts_updateMember = async (args: UpdateMemberArgs): Promise<string> => {
  try {
    const result = await updateMember(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return errorResponse(error);
  }
};

_accounts_deleteMember = async (args: DeleteMemberArgs): Promise<string> => {
  try {
    await deleteMember(resolveDeps(), args.id);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return errorResponse(error);
  }
};

_accounts_replaceAllMembers = async (args: ReplaceAllMembersArgs): Promise<string> => {
  try {
    const result = await replaceAllMembers(resolveDeps(), args.members);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return errorResponse(error);
  }
};

_accounts_setPassword = async (args: SetPasswordArgs): Promise<string> => {
  try {
    await setPassword(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return errorResponse(error);
  }
};

_accounts_login = async (args: LoginArgs): Promise<string> => {
  try {
    const result = await login(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    // 認証失敗はクライアントにリトライさせない(遅延とブルートフォースの増幅を避ける)。
    if (error instanceof InvalidCredentialsError) {
      return JSON.stringify({ status: "error", message: error.message, retryable: false });
    }
    return errorResponse(error);
  }
};

_accounts_logout = async (args: LogoutArgs): Promise<string> => {
  try {
    await logout(resolveDeps(), args.token);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return errorResponse(error);
  }
};

_accounts_getSession = async (args: GetSessionArgs): Promise<string> => {
  try {
    const result = await getSession(resolveDeps(), args.token);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return errorResponse(error);
  }
};

// 認可ポリシー。名簿(id/name)の取得とログイン系は誰でも、それ以外の変更・管理者向け一覧は管理者のみ。
_accounts_listMembers = secure("public", _accounts_listMembers);
_accounts_listAccounts = secure("admin", _accounts_listAccounts);
_accounts_addMember = secure("admin", _accounts_addMember);
_accounts_updateMember = secure("admin", _accounts_updateMember);
_accounts_deleteMember = secure("admin", _accounts_deleteMember);
_accounts_replaceAllMembers = secure("admin", _accounts_replaceAllMembers);
_accounts_setPassword = secure("admin", _accounts_setPassword);
_accounts_login = secure("public", _accounts_login);
_accounts_logout = secure("public", _accounts_logout);
_accounts_getSession = secure("public", _accounts_getSession);

/** Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。 */
export const ACCOUNTS_HANDLERS: Record<AccountsEndpointName, (args: any) => Promise<string>> = {
  listMembers: _accounts_listMembers,
  listAccounts: _accounts_listAccounts,
  addMember: _accounts_addMember,
  updateMember: _accounts_updateMember,
  deleteMember: _accounts_deleteMember,
  replaceAllMembers: _accounts_replaceAllMembers,
  setPassword: _accounts_setPassword,
  login: _accounts_login,
  logout: _accounts_logout,
  getSession: _accounts_getSession,
};

export { ACCOUNTS_PREFIX };
