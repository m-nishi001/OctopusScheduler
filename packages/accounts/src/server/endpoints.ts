/**
 * accounts の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case呼び出し -> ApiResponseに詰めてJSON.stringify」
 * という薄い層のみを担う。マスタメンバーデータは app-scheduler本体・各ゲームパッケージ
 * から共有される単一の名簿として IKeyValueStorage に保存する。
 */
import { errorResponse, respond } from "@octopus/infrastructures/interfaces";
import { container } from "tsyringe";
import {
  IKeyValueStorageToken,
  ILockToken,
  IPasswordHasherToken,
  ISecretProviderToken,
  IUuidGeneratorToken,
} from "@octopus/infrastructures/interfaces";
import type {
  IKeyValueStorage,
  ILock,
  IPasswordHasher,
  ISecretProvider,
  IUuidGenerator,
} from "@octopus/infrastructures/interfaces";
import type {
  AddMemberArgs,
  DeleteMemberArgs,
  GetSessionArgs,
  IssueLoginKeyArgs,
  ListMembersArgs,
  LoginArgs,
  LoginWithKeyArgs,
  LogoutArgs,
  MemberPhotoHashesArgs,
  PutMemberPhotoArgs,
  AccountsEndpointName,
  ApplyRosterArgs,
  RevokeLoginKeyArgs,
  SetPasswordArgs,
  UpdateMemberArgs,
} from "./accounts-api-contract";
import { ACCOUNTS_PREFIX } from "./accounts-api-contract";
import { secure, secureMember } from "./secure";
import { existsMemberPhotos, getMemberPhotos, putMemberPhoto } from "./member-photos";
import {
  addMember,
  deleteMember,
  getRosterUsage,
  getSession,
  InvalidCredentialsError,
  issueLoginKey,
  listAccounts,
  LoginLockedError,
  listMembers,
  login,
  loginWithKey,
  logout,
  applyRoster,
  revokeLoginKey,
  setPassword,
  updateMember,
} from "./accounts-use-cases";

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    generateId: (): string => container.resolve<IUuidGenerator>(IUuidGeneratorToken).generate(),
    hasher: container.resolve<IPasswordHasher>(IPasswordHasherToken),
    now: (): number => Date.now(),
    secrets: container.resolve<ISecretProvider>(ISecretProviderToken),
    lock: container.resolve<ILock>(ILockToken),
  };
}

declare let _accounts_listAccounts: (args: ListMembersArgs) => Promise<string>;
declare let _accounts_getRosterUsage: (args: ListMembersArgs) => Promise<string>;
declare let _accounts_listMembers: (args: ListMembersArgs) => Promise<string>;
declare let _accounts_addMember: (args: AddMemberArgs) => Promise<string>;
declare let _accounts_updateMember: (args: UpdateMemberArgs) => Promise<string>;
declare let _accounts_deleteMember: (args: DeleteMemberArgs) => Promise<string>;
declare let _accounts_applyRoster: (args: ApplyRosterArgs) => Promise<string>;
declare let _accounts_putMemberPhoto: (args: PutMemberPhotoArgs) => Promise<string>;
declare let _accounts_existsMemberPhotos: (args: MemberPhotoHashesArgs) => Promise<string>;
declare let _accounts_getMemberPhotos: (args: MemberPhotoHashesArgs) => Promise<string>;
declare let _accounts_setPassword: (args: SetPasswordArgs) => Promise<string>;
declare let _accounts_login: (args: LoginArgs) => Promise<string>;
declare let _accounts_issueLoginKey: (args: IssueLoginKeyArgs) => Promise<string>;
declare let _accounts_revokeLoginKey: (args: RevokeLoginKeyArgs) => Promise<string>;
declare let _accounts_loginWithKey: (args: LoginWithKeyArgs) => Promise<string>;
declare let _accounts_logout: (args: LogoutArgs) => Promise<string>;
declare let _accounts_getSession: (args: GetSessionArgs) => Promise<string>;

_accounts_listMembers = async (_args: ListMembersArgs): Promise<string> => {
  return respond(() => listMembers(resolveDeps()));
};

_accounts_listAccounts = async (_args: ListMembersArgs): Promise<string> => {
  return respond(() => listAccounts(resolveDeps()));
};

_accounts_getRosterUsage = async (_args: ListMembersArgs): Promise<string> => {
  return respond(() => getRosterUsage(resolveDeps()));
};

_accounts_addMember = async (args: AddMemberArgs): Promise<string> => {
  return respond(() => addMember(resolveDeps(), args));
};

_accounts_updateMember = async (args: UpdateMemberArgs): Promise<string> => {
  return respond(() => updateMember(resolveDeps(), args));
};

_accounts_deleteMember = async (args: DeleteMemberArgs): Promise<string> => {
  return respond(async () => {
    await deleteMember(resolveDeps(), args.id);
  });
};

_accounts_applyRoster = async (args: ApplyRosterArgs): Promise<string> => {
  return respond(() => applyRoster(resolveDeps(), args));
};

_accounts_putMemberPhoto = async (args: PutMemberPhotoArgs): Promise<string> => {
  return respond(() => putMemberPhoto(resolveDeps(), args));
};

_accounts_existsMemberPhotos = async (args: MemberPhotoHashesArgs): Promise<string> => {
  return respond(() => existsMemberPhotos(resolveDeps(), args.hashes));
};

_accounts_getMemberPhotos = async (args: MemberPhotoHashesArgs): Promise<string> => {
  return respond(() => getMemberPhotos(resolveDeps(), args.hashes));
};

_accounts_setPassword = async (args: SetPasswordArgs): Promise<string> => {
  return respond(async () => {
    await setPassword(resolveDeps(), args);
  });
};

_accounts_login = async (args: LoginArgs): Promise<string> => {
  try {
    const result = await login(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    // 認証失敗はクライアントにリトライさせない(遅延とブルートフォースの増幅を避ける)。
    if (error instanceof InvalidCredentialsError || error instanceof LoginLockedError) {
      return JSON.stringify({ status: "error", message: error.message, retryable: false });
    }
    return errorResponse(error);
  }
};

_accounts_issueLoginKey = async (args: IssueLoginKeyArgs): Promise<string> => {
  return respond(() => issueLoginKey(resolveDeps(), args));
};

_accounts_revokeLoginKey = async (args: RevokeLoginKeyArgs): Promise<string> => {
  return respond(async () => {
    await revokeLoginKey(resolveDeps(), args);
  });
};

_accounts_loginWithKey = async (args: LoginWithKeyArgs): Promise<string> => {
  try {
    const result = await loginWithKey(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    // パスワードログインと同じく、認証失敗はリトライさせない。
    if (error instanceof InvalidCredentialsError || error instanceof LoginLockedError) {
      return JSON.stringify({ status: "error", message: error.message, retryable: false });
    }
    return errorResponse(error);
  }
};

_accounts_logout = async (args: LogoutArgs): Promise<string> => {
  return respond(async () => {
    await logout(resolveDeps(), args.token);
  });
};

_accounts_getSession = async (args: GetSessionArgs): Promise<string> => {
  return respond(() => getSession(resolveDeps(), args.token));
};

// 認可ポリシー。名簿(id/name)の取得とログイン系は誰でも、それ以外の変更・管理者向け一覧は管理者のみ。
_accounts_listMembers = secure("public", _accounts_listMembers);
_accounts_listAccounts = secure("admin", _accounts_listAccounts);
_accounts_getRosterUsage = secure("admin", _accounts_getRosterUsage);
_accounts_addMember = secure("admin", _accounts_addMember);
_accounts_updateMember = secure("admin", _accounts_updateMember);
_accounts_deleteMember = secure("admin", _accounts_deleteMember);
_accounts_applyRoster = secure("admin", _accounts_applyRoster);
// 写真は書き込み・存在確認が管理者のみ。読み取りはログイン済みなら参加者も(エントリー画面などで顔を出すため)。
_accounts_putMemberPhoto = secure("admin", _accounts_putMemberPhoto);
_accounts_existsMemberPhotos = secure("admin", _accounts_existsMemberPhotos);
_accounts_getMemberPhotos = secureMember(_accounts_getMemberPhotos);
_accounts_setPassword = secure("admin", _accounts_setPassword);
_accounts_login = secure("public", _accounts_login);
// キーの発行・失効は管理者のみ。キーでのログインは入口なので公開(キーそのものが資格情報)。
_accounts_issueLoginKey = secure("admin", _accounts_issueLoginKey);
_accounts_revokeLoginKey = secure("admin", _accounts_revokeLoginKey);
_accounts_loginWithKey = secure("public", _accounts_loginWithKey);
_accounts_logout = secure("public", _accounts_logout);
_accounts_getSession = secure("public", _accounts_getSession);

/** Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。 */
export const ACCOUNTS_HANDLERS: Record<AccountsEndpointName, (args: any) => Promise<string>> = {
  listMembers: _accounts_listMembers,
  listAccounts: _accounts_listAccounts,
  getRosterUsage: _accounts_getRosterUsage,
  addMember: _accounts_addMember,
  updateMember: _accounts_updateMember,
  deleteMember: _accounts_deleteMember,
  applyRoster: _accounts_applyRoster,
  putMemberPhoto: _accounts_putMemberPhoto,
  existsMemberPhotos: _accounts_existsMemberPhotos,
  getMemberPhotos: _accounts_getMemberPhotos,
  setPassword: _accounts_setPassword,
  login: _accounts_login,
  issueLoginKey: _accounts_issueLoginKey,
  revokeLoginKey: _accounts_revokeLoginKey,
  loginWithKey: _accounts_loginWithKey,
  logout: _accounts_logout,
  getSession: _accounts_getSession,
};

export { ACCOUNTS_PREFIX };
