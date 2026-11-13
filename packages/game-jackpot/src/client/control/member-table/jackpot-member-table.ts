/**
 * ジャックポットのメンバーの表(CSV)。共通の名簿の表(`@octopus/accounts` の {@link ROSTER_TABLE})に、
 * ジャックポット固有の「当選しやすさ」(メンバー抽選の当選しやすさ、1〜10)と「抽選対象」(あり/なし)の列を足したもの。
 *
 * - 列: `ID*, 名前, 当選しやすさ, 抽選対象`。空のセル(抽選対象も同じで「変更しない」) = いまのまま。写真は持たない(ジャックポットのメンバーは写真なし)。
 *   古い書き出しの「写真」「ランク」列は読まずに無視する(ランクは廃止した)。
 * - 名前は名簿に書く(名簿の人は削除しない = 置き換えは無い)。
 *   当選しやすさは、名簿に書いたあとに、メンバーの拡張設定へ1回の書き込みで反映する。
 * - 名簿にいない ID: 名前があれば名簿に追加する(当選しやすさもそのとき設定する)。名前が無ければエラー(行を直すまで取り込めない)。
 *   名簿にいる人は、名前を空にしておけば名前を変えず、当選しやすさだけを変えられる。
 */
import { rosterAdapter } from "@octopus/accounts";
import type { RosterAdapterOptions, RosterMember, RosterTable } from "@octopus/accounts";
import type { Header, Row, TableAdapter } from "@octopus/table-io";
import { DEFAULT_ELIGIBLE } from "../../model/member/eligibility";
import { MAX_WEIGHT, MIN_WEIGHT } from "../../model/draw/weighted-selector";

export const JACKPOT_MEMBER_CSV_NAME = "jackpot-members.csv";

export const JACKPOT_MEMBER_HEADERS: readonly Header[] = [
  { key: "id", label: "ID", aliases: ["メンバーID"], required: true },
  { key: "name", label: "名前", aliases: ["name", "氏名"] },
  { key: "weight", label: "当選しやすさ", aliases: ["メンバー抽選の当選しやすさ", "weight", "重み"] },
  { key: "eligible", label: "抽選対象", aliases: ["eligible"] },
];

/** 抽選対象のセルの書き方(あり/なしだけ。管理者の列と同じ)。 */
const ELIGIBLE_ON = "あり";
const ELIGIBLE_OFF = "なし";

/** 取込の計画で扱うメンバー1人: 名簿の人に、ジャックポット固有の設定を足したもの。未設定(undefined)は「いまのまま」。 */
export interface JackpotMemberRow extends RosterMember {
  weight?: number;
  eligible?: boolean;
}

/** メンバーの拡張設定の読み書き(`MemberRepository` がそのまま満たす)。 */
export interface MemberExtrasPort {
  readExtras(): Promise<ReadonlyMap<string, { weight?: number; eligible?: boolean }>>;
  setExtras(rows: { id: string; weight?: number; eligible?: boolean }[]): Promise<unknown>;
}

/** メンバーの `TableAdapter`。名簿の列の検証は名簿の `rosterAdapter` に任せ、当選しやすさの列だけ足す。 */
export function jackpotMemberAdapter(options: RosterAdapterOptions = {}): TableAdapter<JackpotMemberRow> {
  const base = rosterAdapter(options);
  return {
    csvName: JACKPOT_MEMBER_CSV_NAME,
    headers: JACKPOT_MEMBER_HEADERS,
    labelKey: "name",
    key: (m) => m.id,
    toRow: (m): Row => ({
      id: m.id,
      name: m.name,
      weight: m.weight === undefined ? "" : String(m.weight),
      eligible: m.eligible === undefined ? "" : m.eligible ? ELIGIBLE_ON : ELIGIBLE_OFF,
    }),
    fromRow(row, existing) {
      if (!existing && !row.name) return "名簿にない ID です。名前を入れると名簿に追加します";
      const built = base.fromRow({ ...row, name: row.name || existing?.name || "" }, existing);
      if (typeof built === "string") return built;

      let weight = existing?.weight;
      if (row.weight) {
        const n = Number(row.weight);
        if (!Number.isInteger(n) || n < MIN_WEIGHT || n > MAX_WEIGHT) return `メンバー抽選の当選しやすさは${MIN_WEIGHT}〜${MAX_WEIGHT}の整数で入力してください`;
        weight = n;
      }

      let eligible = existing?.eligible;
      if (row.eligible) {
        if (row.eligible !== ELIGIBLE_ON && row.eligible !== ELIGIBLE_OFF) return "抽選対象は「あり」か「なし」で入力してください";
        eligible = row.eligible === ELIGIBLE_ON;
      }
      return { ...built, weight, eligible };
    },
  };
}

/** ジャックポットのメンバーの表の定義(名簿の取込・書き出しの `table` に渡す)。 */
export function jackpotMemberTable(extras: MemberExtrasPort): RosterTable<JackpotMemberRow> {
  return {
    headers: JACKPOT_MEMBER_HEADERS,
    adapter: jackpotMemberAdapter,
    async current(members, photoFiles) {
      const all = await extras.readExtras();
      return members.map((m) => ({
        id: m.id,
        name: m.name,
        photo: m.photo,
        photoFile: photoFiles.get(m.id),
        isAdmin: m.isAdmin,
        weight: all.get(m.id)?.weight,
        eligible: all.get(m.id)?.eligible ?? DEFAULT_ELIGIBLE,
      }));
    },
    async afterApply(applied) {
      const rows = applied.filter((m) => m.weight !== undefined || m.eligible !== undefined).map((m) => ({ id: m.id, weight: m.weight, eligible: m.eligible }));
      if (rows.length > 0) await extras.setExtras(rows);
    },
  };
}
