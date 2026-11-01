/**
 * クイズ一覧の表(CSV)への対応。汎用の判断(差分・往復・エラー)は `@octopus/table-io` に任せ、ここは列と検証だけを持つ。
 *
 * - 取り込む対象はレコードのクイズそのもの({@link QuizRecordEntry})。画像・音声はファイル名(素材の名前)で持つ。
 * - 列: `ID, タイトル*, 問題*, 制限時間(秒), 正解(選択肢の番号), BGM, 正解BGM, 景品名, 景品画像, 景品BGM`、
 *   続けて選択肢ごとに `選択肢k / 選択肢k画像 / 選択肢k色`。k は選択肢の番号で、列の数はファイルによって変わる。
 * - 素材のセル: 空 = いまのまま、`-` = 外す、それ以外 = ファイル名。
 */
import type { Header, Row, TableAdapter } from "@octopus/table-io";
import type { QuizRecordEntry } from "../../../server/quiz-api-contract";

export const QUIZ_CSV_NAME = "quizzes.csv";
export const DEFAULT_TIME_LIMIT = 30;
export const DEFAULT_OPTION_COLOR = "red";
/** 選択肢の列の数の上限(見出しに途方もない番号があっても列を作りすぎない)。 */
export const MAX_OPTION_COLUMNS = 100;
/** 素材のセルに書くと、素材を外す。 */
export const REMOVE_MEDIA = "-";

const MAX_TIME_LIMIT = 3600;
const PALETTE = ["red", "blue", "green", "yellow", "purple"];
const HEX_COLOR = /^#[0-9a-f]{6}$/;

const FIXED_HEADERS: readonly Header[] = [
  { key: "id", label: "ID", aliases: ["クイズID"] },
  { key: "title", label: "タイトル", aliases: ["title", "クイズ名"], required: true },
  { key: "question", label: "問題", aliases: ["question", "クイズ内容"], required: true },
  { key: "timeLimit", label: "制限時間(秒)", aliases: ["制限時間", "回答時間", "timeLimit"] },
  { key: "correctNo", label: "正解(選択肢の番号)", aliases: ["正解", "correct"] },
  { key: "bgm", label: "BGM", media: true },
  { key: "correctBgm", label: "正解BGM", aliases: ["正解表示BGM", "correctBgm"], media: true },
  { key: "prizeName", label: "景品名", aliases: ["当選景品名", "prizeName"] },
  { key: "prizeImage", label: "景品画像", aliases: ["当選景品画像", "prizeImage"], media: true },
  { key: "prizeBgm", label: "景品BGM", aliases: ["当選景品BGM", "prizeBgm"], media: true },
];

const optionKeys = (k: number) => ({ text: `o${k}`, image: `o${k}Image`, color: `o${k}Color` });

/** 選択肢が `count` 番までの列の定義。 */
export function quizHeaders(count: number): Header[] {
  const options = Array.from({ length: count }, (_, i): Header[] => {
    const k = i + 1;
    const key = optionKeys(k);
    return [
      { key: key.text, label: `選択肢${k}`, aliases: [`option${k}`] },
      { key: key.image, label: `選択肢${k}画像`, aliases: [`option${k}image`], media: true },
      { key: key.color, label: `選択肢${k}色`, aliases: [`option${k}color`] },
    ];
  });
  return [...FIXED_HEADERS, ...options.flat()];
}

/** CSV の見出し(`normalizeHeader` 済み)にある、選択肢の列の最大の番号。`選択肢k(画像|色)?` と英語の別名 `optionk(image|color)?`。 */
export function optionColumnCount(names: readonly string[]): number {
  let max = 0;
  for (const name of names) {
    const k = Number(/^(?:選択肢|option)(\d+)(?:画像|色|image|color)?$/.exec(name)?.[1]);
    if (k >= 1 && k <= MAX_OPTION_COLUMNS) max = Math.max(max, k);
  }
  return max;
}

/** 列の定義にある、選択肢の番号の最大。 */
export const headerOptionCount = (headers: readonly Header[]): number => (headers.length - FIXED_HEADERS.length) / 3;

/** 見出しから列の定義を決める(`parseTable` に渡す)。 */
export const quizHeadersFromNames = (names: readonly string[]): Header[] => quizHeaders(optionColumnCount(names));

/** クイズたちの選択肢の番号の最大(書き出す列の数)。 */
export const maxOptionNo = (quizzes: readonly QuizRecordEntry[]): number =>
  quizzes.reduce((max, q) => q.options.reduce((m, o) => Math.max(m, o.no), max), 0);

/** 素材のファイル名の照合用: フォルダ部分を除き、前後の空白を除く。 */
export const mediaFileName = (cell: string): string => (cell.split(/[\\/]/).pop() ?? "").trim();

export interface QuizAdapterOptions {
  /** 選択肢の番号の最大(列の数)。 */
  optionCount: number;
  /** 使える素材の名前(いまの素材 + 選ばれたファイル)。CSV が指す素材がこの中に無ければエラー。省略すると検査しない(書き出し用)。 */
  available?: ReadonlySet<string>;
}

class RowError extends Error {}

/** クイズ一覧の `TableAdapter`。取込では使える素材の名前を渡し、書き出しでは列の数だけを渡す。 */
export function quizAdapter({ optionCount, available }: QuizAdapterOptions): TableAdapter<QuizRecordEntry> {
  const mediaRef = (label: string, cell: string | undefined, previous: string | null | undefined): string | null => {
    const value = (cell ?? "").trim();
    if (value === "") return previous ?? null;
    if (value === REMOVE_MEDIA) return null;
    const name = mediaFileName(value);
    if (available && !available.has(name)) throw new RowError(`${label}「${name}」が見つかりません`);
    return name;
  };

  function build(row: Row, existing: QuizRecordEntry | undefined): QuizRecordEntry {
    if (!row.title) throw new RowError("タイトルが空です");
    if (!row.question) throw new RowError("問題が空です");

    let timeLimit = existing?.timeLimit ?? DEFAULT_TIME_LIMIT;
    if (row.timeLimit) {
      timeLimit = Number(row.timeLimit);
      if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > MAX_TIME_LIMIT) {
        throw new RowError(`制限時間は1〜${MAX_TIME_LIMIT}の整数(秒)で入力してください`);
      }
    }

    const options: QuizRecordEntry["options"] = [];
    for (let k = 1; k <= optionCount; k++) {
      const key = optionKeys(k);
      const before = existing?.options.find((o) => o.no === k);
      const text = row[key.text] ?? "";
      const image = mediaRef(`選択肢${k}の画像`, row[key.image], before?.image);
      if (text === "" && image === null) continue;
      const colorCell = (row[key.color] ?? "").toLowerCase();
      if (colorCell !== "" && !HEX_COLOR.test(colorCell) && !PALETTE.includes(colorCell)) {
        throw new RowError(`選択肢${k}の色は #rrggbb の形式で入力してください`);
      }
      options.push({ no: k, text, color: colorCell || before?.color || DEFAULT_OPTION_COLOR, image });
    }

    let correctNo = existing && options.some((o) => o.no === existing.correctNo) ? existing.correctNo : (options[0]?.no ?? 1);
    if (row.correctNo) {
      correctNo = Number(row.correctNo);
      if (!options.some((o) => o.no === correctNo)) throw new RowError(`正解の選択肢${row.correctNo}がありません`);
    }

    const before = existing?.settings;
    return {
      id: row.id,
      title: row.title,
      question: row.question,
      options,
      correctNo,
      timeLimit,
      bgm: mediaRef("BGM", row.bgm, existing?.bgm),
      settings: {
        correctBgm: mediaRef("正解BGM", row.correctBgm, before?.correctBgm),
        prizeImage: mediaRef("景品画像", row.prizeImage, before?.prizeImage),
        prizeName: row.prizeName ?? "",
        prizeBgm: mediaRef("景品BGM", row.prizeBgm, before?.prizeBgm),
      },
    };
  }

  return {
    csvName: QUIZ_CSV_NAME,
    headers: quizHeaders(optionCount),
    labelKey: "title",
    key: (q) => q.id,
    newKey: () => crypto.randomUUID(),
    toRow(q): Row {
      const s = q.settings;
      const row: Row = {
        id: q.id,
        title: q.title,
        question: q.question,
        timeLimit: String(q.timeLimit),
        // 存在しない選択肢を指す正解は、空にして書く(取り込むと先頭の選択肢になる)。
        correctNo: q.options.some((o) => o.no === q.correctNo) ? String(q.correctNo) : "",
        bgm: q.bgm ?? "",
        correctBgm: s?.correctBgm ?? "",
        prizeName: s?.prizeName ?? "",
        prizeImage: s?.prizeImage ?? "",
        prizeBgm: s?.prizeBgm ?? "",
      };
      for (const o of q.options) {
        const key = optionKeys(o.no);
        row[key.text] = o.text;
        row[key.image] = o.image ?? "";
        row[key.color] = o.color;
      }
      return row;
    },
    fromRow(row, existing) {
      try {
        return build(row, existing);
      } catch (e) {
        if (e instanceof RowError) return e.message;
        throw e;
      }
    },
  };
}
