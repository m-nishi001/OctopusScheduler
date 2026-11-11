/**
 * 名簿の表(CSV)への対応。汎用の判断(差分・往復・エラー)は `@octopus/table-io` に任せ、ここは名簿の列と検証だけを持つ。
 *
 * - 書式: ヘッダー行 `ID,名前,写真`。写真の列は画像のファイル名(書き出しでは `<id>.<拡張子>`)。空なら写真は変えない。
 * - 設定>メンバーの表({@link ADMIN_ROSTER_TABLE})だけ、`管理者`(あり/なし)の列が付く。空なら管理者かどうかは変えない。
 *   クイズのメンバー管理・ジャックポットのメンバーの表には、この列を出さない(管理者の付け外しは設定>メンバーだけ)。
 *   ログイン中のメンバー自身を「なし」にする行はエラー(サーバーも拒否する)。
 * - 削除は置き換えモードのときだけ。管理者とログイン中のメンバーは削除しない。
 */
import type { HeadersSource, Row, TableAdapter, Header } from "@octopus/table-io";
import type { Member } from "../../../server/accounts-api-contract";

const MAX_ID_LENGTH = 64;
const MAX_NAME_LENGTH = 100;

export const ROSTER_CSV_NAME = "members.csv";

/** 管理者のセルの書き方(あり/なしだけ)。 */
const ADMIN_ON = "あり";
const ADMIN_OFF = "なし";

export const ROSTER_HEADERS: readonly Header[] = [
  { key: "id", label: "ID", aliases: ["メンバーID"], required: true },
  { key: "name", label: "名前", aliases: ["name", "氏名"], required: true },
  { key: "photo", label: "写真", aliases: ["photo", "画像"], media: true },
];

/** 名簿の列に、管理者の列を足したもの(設定>メンバー用)。 */
export const ROSTER_ADMIN_HEADERS: readonly Header[] = [...ROSTER_HEADERS, { key: "isAdmin", label: "管理者" }];

/**
 * 取込の計画で扱う名簿の1人。`photo` は名簿に記録されている写真のハッシュ、`photoFile` は CSV の写真の列(のファイル名)。
 * 写真の中身が名簿の写真と同じ(書き出した写真をそのまま戻した)ときだけ、既存の人に `photoFile` が付く。
 */
export interface RosterMember {
  id: string;
  name: string;
  photo?: string;
  photoFile?: string;
  isAdmin?: boolean;
}

/** 画像のファイル名の照合用キー: フォルダ部分を除き、大文字小文字と全角半角の差を無視する。 */
export function photoFileKey(name: string): string {
  return (name.split(/[\\/]/).pop() ?? "").normalize("NFKC").toLowerCase();
}

/** 画像の MIME から、書き出すファイルの拡張子。 */
export function photoExtension(mime: string): string {
  switch (mime) {
    case "image/webp":
      return "webp";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    default:
      return "img";
  }
}

/** ファイル名に使えない文字を `_` にする。 */
const safeFileStem = (id: string): string => Array.from(id, (ch) => (ch < " " || '\\/:*?"<>|'.includes(ch) ? "_" : ch)).join("");

/** 書き出す写真のファイル名(`<id>.<拡張子>`)。 */
export function photoFileName(id: string, mime: string): string {
  return `${safeFileStem(id)}.${photoExtension(mime)}`;
}

export interface RosterAdapterOptions {
  /** 選ばれた画像の照合キー({@link photoFileKey})。CSV が指す画像がこの中に無ければエラー。省略すると検査しない(書き出し用)。 */
  files?: ReadonlySet<string>;
  /** ログイン中のメンバー(削除しない)。 */
  currentUserId?: string;
  /** 真なら ID の空の行はエラー(ID を必ず決める画面用)。偽なら空の ID は新規で、名簿が採番する。 */
  idRequired?: boolean;
  /** 真なら「管理者」の列を持つ(設定>メンバー用)。偽なら管理者かどうかは表に出さず、いまのまま。 */
  adminColumn?: boolean;
}

/** 名簿の `TableAdapter`。取込では選ばれた画像の一覧とログイン中のメンバーを渡し、書き出しでは引数なしで使う。 */
export function rosterAdapter(options: RosterAdapterOptions = {}): TableAdapter<RosterMember> {
  return {
    csvName: ROSTER_CSV_NAME,
    headers: options.adminColumn ? ROSTER_ADMIN_HEADERS : ROSTER_HEADERS,
    labelKey: "name",
    key: (m) => m.id,
    toRow: (m): Row => ({
      id: m.id,
      name: m.name,
      photo: m.photoFile ?? "",
      ...(options.adminColumn ? { isAdmin: m.isAdmin ? ADMIN_ON : ADMIN_OFF } : {}),
    }),
    fromRow(row, existing) {
      if (options.idRequired && !row.id) return "ID が空です";
      if (!row.name) return "名前が空です";
      if (row.name.length > MAX_NAME_LENGTH) return `名前が長すぎます(${MAX_NAME_LENGTH}文字まで)`;
      if (row.id.length > MAX_ID_LENGTH) return `ID が長すぎます(${MAX_ID_LENGTH}文字まで)`;
      let photoFile = existing?.photoFile;
      if (row.photo) {
        photoFile = photoFileKey(row.photo);
        if (options.files && !options.files.has(photoFile)) return `画像「${row.photo}」が見つかりません`;
      }

      let isAdmin = existing?.isAdmin;
      if (options.adminColumn && row.isAdmin) {
        if (row.isAdmin !== ADMIN_ON && row.isAdmin !== ADMIN_OFF) return "管理者は「あり」か「なし」で入力してください";
        isAdmin = row.isAdmin === ADMIN_ON;
        if (!isAdmin && existing?.isAdmin && row.id === options.currentUserId) return "ログイン中の自分の管理者権限は外せません";
      }
      return { id: row.id, name: row.name, photo: existing?.photo, photoFile, isAdmin };
    },
    protected: (m) => m.isAdmin === true || m.id === options.currentUserId,
  };
}

/** 名簿の人を取込の計画で扱う形にする。`photoFiles` は メンバーの ID → CSV に書く(書いてある)写真のファイル名。 */
export function toRosterMembers(members: readonly Member[], photoFiles: ReadonlyMap<string, string> = new Map()): RosterMember[] {
  return members.map((m) => ({ id: m.id, name: m.name, photo: m.photo, photoFile: photoFiles.get(m.id), isAdmin: m.isAdmin }));
}

/**
 * 名簿の取込・書き出しの「表の定義」。名簿そのもの({@link ROSTER_TABLE})のほか、名簿の人に列を足したい画面
 * (例: ジャックポットのメンバーの「当選しやすさ」)が、写真の縮小・送信・名簿の書き込みを共有するために差し替える。
 */
export interface RosterTable<E extends RosterMember = RosterMember> {
  /** CSV の列の定義(見出しから決めるときは関数)。 */
  headers: HeadersSource;
  adapter(options: RosterAdapterOptions): TableAdapter<E>;
  /** 名簿の人を、取込の計画で扱う項目にする。`photoFiles` は メンバーの ID → CSV に書く(書いてある)写真のファイル名。 */
  current(members: readonly Member[], photoFiles: ReadonlyMap<string, string>): E[] | Promise<E[]>;
  /** 名簿に書いたあとに呼ぶ。追加・更新した項目(写真を用意できなかった行は含まない)について、名簿の外にある項目を書く。 */
  afterApply?(applied: readonly E[]): Promise<void>;
}

/** 管理者の列を持たない名簿の表(クイズ>メンバー管理が使う。取込・書き出しの既定)。 */
export const ROSTER_TABLE: RosterTable = {
  headers: ROSTER_HEADERS,
  adapter: rosterAdapter,
  current: toRosterMembers,
};

/** 管理者の列を持つ名簿の表(設定>メンバーが使う)。 */
export const ADMIN_ROSTER_TABLE: RosterTable = {
  headers: ROSTER_ADMIN_HEADERS,
  adapter: (options) => rosterAdapter({ ...options, adminColumn: true }),
  current: toRosterMembers,
};
