/**
 * ジャックポットのメンバーの表(CSV)。共通の名簿の表(`@octopus/accounts` の {@link ROSTER_TABLE})に、
 * ジャックポット固有の「ランク」「当選しやすさ」の列を足したもの。
 *
 * - 列: `ID*, 名前, 写真, ランク, 当選しやすさ`。空のセル = いまのまま。
 * - 名前と写真は名簿に書く(名簿の取込と同じ縮小・送信。名簿の人は削除しない = 置き換えは無い)。
 *   ランクと当選しやすさは、名簿に書いたあとに、メンバーの拡張設定へ1回の書き込みで反映する。
 * - 名簿にいない ID: 名前があれば名簿に追加する(ランク・当選しやすさもそのとき設定する)。名前が無ければエラー(行を直すまで取り込めない)。
 *   名簿にいる人は、名前を空にしておけば名前を変えず、ランク・当選しやすさだけを変えられる。
 */
import { rosterAdapter } from "@octopus/accounts";
import type { RosterAdapterOptions, RosterMember, RosterTable } from "@octopus/accounts";
import type { Header, Row, TableAdapter } from "@octopus/table-io";
import { MAX_WEIGHT, MIN_WEIGHT } from "../../model/draw/weighted-selector";
import { DEFAULT_RANK } from "../../model/member/member-repository";

export const JACKPOT_MEMBER_CSV_NAME = "jackpot-members.csv";

export const JACKPOT_MEMBER_HEADERS: readonly Header[] = [
  { key: "id", label: "ID", aliases: ["メンバーID"], required: true },
  { key: "name", label: "名前", aliases: ["name", "氏名"] },
  { key: "photo", label: "写真", aliases: ["photo", "画像"], media: true },
  { key: "rank", label: "ランク", aliases: ["rank"] },
  { key: "weight", label: "当選しやすさ", aliases: ["weight", "重み"] },
];

/** 取込の計画で扱うメンバー1人: 名簿の人に、ジャックポット固有の設定を足したもの。未設定(undefined)は「いまのまま」。 */
export interface JackpotMemberRow extends RosterMember {
  rank?: number;
  weight?: number;
}

/** メンバーの拡張設定の読み書き(`MemberRepository` がそのまま満たす)。 */
export interface MemberExtrasPort {
  readExtras(): Promise<ReadonlyMap<string, { rank: number; weight?: number }>>;
  setExtras(rows: { id: string; rank?: number; weight?: number }[]): Promise<unknown>;
}

/** メンバーの `TableAdapter`。名簿の列の検証は名簿の `rosterAdapter` に任せ、ランク・当選しやすさの列だけ足す。 */
export function jackpotMemberAdapter(options: RosterAdapterOptions = {}): TableAdapter<JackpotMemberRow> {
  const base = rosterAdapter(options);
  return {
    csvName: JACKPOT_MEMBER_CSV_NAME,
    headers: JACKPOT_MEMBER_HEADERS,
    labelKey: "name",
    key: (m) => m.id,
    toRow: (m): Row => ({
      ...base.toRow(m),
      rank: m.rank === undefined ? "" : String(m.rank),
      weight: m.weight === undefined ? "" : String(m.weight),
    }),
    fromRow(row, existing) {
      if (!existing && !row.name) return "名簿にない ID です。名前を入れると名簿に追加します";
      const built = base.fromRow({ ...row, name: row.name || existing?.name || "" }, existing);
      if (typeof built === "string") return built;

      let rank = existing?.rank;
      if (row.rank) {
        const n = Number(row.rank);
        if (!Number.isInteger(n) || n < 1) return "ランクは1以上の整数で入力してください";
        rank = n;
      }
      let weight = existing?.weight;
      if (row.weight) {
        const n = Number(row.weight);
        if (!Number.isInteger(n) || n < MIN_WEIGHT || n > MAX_WEIGHT) return `当選しやすさは${MIN_WEIGHT}〜${MAX_WEIGHT}の整数で入力してください`;
        weight = n;
      }
      return { ...built, rank, weight };
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
        rank: all.get(m.id)?.rank ?? DEFAULT_RANK,
        weight: all.get(m.id)?.weight,
      }));
    },
    async afterApply(applied) {
      const rows = applied.filter((m) => m.rank !== undefined || m.weight !== undefined).map((m) => ({ id: m.id, rank: m.rank, weight: m.weight }));
      if (rows.length > 0) await extras.setExtras(rows);
    },
  };
}
