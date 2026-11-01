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
  "getRosterUsage",
  "addMember",
  "updateMember",
  "deleteMember",
  "applyRoster",
  "putMemberPhoto",
  "existsMemberPhotos",
  "getMemberPhotos",
  "setPassword",
  "login",
  "issueLoginKey",
  "revokeLoginKey",
  "loginWithKey",
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
  /**
   * 顔写真(縮小後の画像の SHA-256 先頭16桁)。名簿だけが写真の持ち主で、中身は
   * `getMemberPhotos` で取る。同じ画像なら同じ値なので、クライアントのキャッシュは捨てる判断がいらない。
   * 追加・更新で省略すると既存の写真を保ち、空文字を渡すと外す。
   */
  photo?: string;
  /** 管理画面を操作できるか。未設定は管理者ではない。 */
  isAdmin?: boolean;
  /** パスワードが設定済みか(listAccountsの結果にのみ付く。ハッシュ自体は返さない)。 */
  hasPassword?: boolean;
  /** 受付QR用のログインキーが発行済みか(listAccountsの結果にのみ付く。キー自体は返さない)。 */
  hasLoginKey?: boolean;
}

export type ListMembersArgs = Record<string, never>;

/**
 * 名簿が保存先の容量のどれだけを使っているか。名簿は 1 つの値に保存するので、GAS では約9KBが上限
 * (50人なら十分だが、人数が増えると追加できなくなる)。管理画面が、上限に近づいたら警告するために使う。
 */
export interface RosterUsage {
  /** 登録人数。 */
  members: number;
  /** 名簿の保存に使っているバイト数。 */
  usedBytes: number;
  /** 保存できる上限(バイト数)。上限の無い保存先(Cloudflare)は null。 */
  maxBytes: number | null;
}

export interface AddMemberArgs {
  /**
   * 省略時はサーバー側で自動採番する。呼び出し側が人間の入力しやすいID
   * (例: game-quizのログインID)を指定したい場合は明示的に渡す。
   */
  id?: string;
  name: string;
  isAdmin?: boolean;
  photo?: string;
}

/** isAdmin / photo を省略した場合は既存の値を保つ(photo は空文字で外す)。 */
export interface UpdateMemberArgs {
  id: string;
  name: string;
  isAdmin?: boolean;
  photo?: string;
}

export interface DeleteMemberArgs {
  id: string;
}

/** CSV 取込の確定。追加・更新と削除を1回で反映する。管理者を `deleteIds` に含めると全体が拒否される。 */
export interface ApplyRosterArgs {
  /** `photo` は省略=保つ、空文字=外す、値=写真のハッシュ。`id` を省略すると自動採番。 */
  upserts: { id?: string; name: string; photo?: string }[];
  deleteIds: string[];
}

export interface ApplyRosterResult {
  upserted: number;
  deleted: number;
}

export interface PutMemberPhotoArgs {
  /** 画像のSHA-256の先頭16桁(16進)。 */
  hash: string;
  /** `data:image/webp;base64,…` 形式。500KB以下。 */
  dataUrl: string;
}

export interface PutMemberPhotoResult {
  hash: string;
}

export interface MemberPhotoHashesArgs {
  hashes: string[];
}

export interface ExistsMemberPhotosResult {
  /** 渡したハッシュのうち、すでに保存されているもの。 */
  existing: string[];
}

export interface GetMemberPhotosResult {
  /** ハッシュ → データURL。保存されていないハッシュは含まれない。 */
  photos: Record<string, string>;
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

export interface IssueLoginKeyArgs {
  id: string;
}

/** 発行直後の1回だけ平文のキーを返す(サーバーにはハッシュしか残らない)。再発行すると古いキーは無効になる。 */
export interface IssueLoginKeyResult {
  key: string;
}

export interface RevokeLoginKeyArgs {
  id: string;
}

export interface LoginWithKeyArgs {
  id: string;
  key: string;
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
  /** 名簿の容量の使用状況(管理者向け)。 */
  getRosterUsage(args: ListMembersArgs, options?: ApiCallOptions): Promise<RosterUsage>;
  addMember(args: AddMemberArgs, options?: ApiCallOptions): Promise<Member>;
  updateMember(args: UpdateMemberArgs, options?: ApiCallOptions): Promise<Member>;
  deleteMember(args: DeleteMemberArgs, options?: ApiCallOptions): Promise<void>;
  applyRoster(args: ApplyRosterArgs, options?: ApiCallOptions): Promise<ApplyRosterResult>;
  /** 顔写真を保存する(管理者のみ)。同じハッシュなら上書きなので、送り直しても安全。 */
  putMemberPhoto(args: PutMemberPhotoArgs, options?: ApiCallOptions): Promise<PutMemberPhotoResult>;
  /** 保存済みの写真を一度に確かめる(管理者のみ)。 */
  existsMemberPhotos(args: MemberPhotoHashesArgs, options?: ApiCallOptions): Promise<ExistsMemberPhotosResult>;
  /** 写真の中身を最大10枚まとめて取る(ログイン済みなら誰でも)。 */
  getMemberPhotos(args: MemberPhotoHashesArgs, options?: ApiCallOptions): Promise<GetMemberPhotosResult>;
  setPassword(args: SetPasswordArgs, options?: ApiCallOptions): Promise<void>;
  login(args: LoginArgs, options?: ApiCallOptions): Promise<LoginResult>;
  /** 参加者(管理者以外)の受付QR用ログインキーを発行する。管理者には発行できない。 */
  issueLoginKey(args: IssueLoginKeyArgs, options?: ApiCallOptions): Promise<IssueLoginKeyResult>;
  revokeLoginKey(args: RevokeLoginKeyArgs, options?: ApiCallOptions): Promise<void>;
  /** 受付QRのキーでログインする。失敗理由は区別しない(パスワードログインと同じ失敗カウンタ・ロックを共有)。 */
  loginWithKey(args: LoginWithKeyArgs, options?: ApiCallOptions): Promise<LoginResult>;
  logout(args: LogoutArgs, options?: ApiCallOptions): Promise<void>;
  /** トークンが有効ならそのメンバー、無効/期限切れなら null。 */
  getSession(args: GetSessionArgs, options?: ApiCallOptions): Promise<Member | null>;
}

/** `AccountsApi` をDI解決するためのトークン。 */
export const IAccountsApiToken = Symbol("IAccountsApi");
