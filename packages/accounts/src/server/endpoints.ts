/**
 * accounts の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case呼び出し -> ApiResponseに詰めてJSON.stringify」
 * という薄い層のみを担う。マスタメンバーデータは app-scheduler本体・各ゲームパッケージ
 * から共有される単一の名簿として IKeyValueStorage に保存する。
 */
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
import {
  addMember,
  deleteMember,
  getSession,
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
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_accounts_addMember = async (args: AddMemberArgs): Promise<string> => {
  try {
    const result = await addMember(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_accounts_updateMember = async (args: UpdateMemberArgs): Promise<string> => {
  try {
    const result = await updateMember(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_accounts_deleteMember = async (args: DeleteMemberArgs): Promise<string> => {
  try {
    await deleteMember(resolveDeps(), args.id);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_accounts_replaceAllMembers = async (args: ReplaceAllMembersArgs): Promise<string> => {
  try {
    const result = await replaceAllMembers(resolveDeps(), args.members);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_accounts_setPassword = async (args: SetPasswordArgs): Promise<string> => {
  try {
    await setPassword(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_accounts_login = async (args: LoginArgs): Promise<string> => {
  try {
    const result = await login(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_accounts_logout = async (args: LogoutArgs): Promise<string> => {
  try {
    await logout(resolveDeps(), args.token);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_accounts_getSession = async (args: GetSessionArgs): Promise<string> => {
  try {
    const result = await getSession(resolveDeps(), args.token);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

/** Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。 */
export const ACCOUNTS_HANDLERS: Record<AccountsEndpointName, (args: any) => Promise<string>> = {
  listMembers: _accounts_listMembers,
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
