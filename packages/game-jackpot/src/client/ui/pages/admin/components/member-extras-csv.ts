import { MAX_WEIGHT, MIN_WEIGHT } from '@model/draw/weighted-selector';

export interface MemberExtrasRow {
    id: string;
    rank?: number;
    weight?: number;
}

/** 引用符つきの1行を列に分ける(簡易版)。セル内の改行・Shift_JIS は扱わない。 */
function splitLine(line: string): string[] {
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            cols.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    cols.push(cur.trim());
    return cols;
}

/**
 * ジャックポットの「メンバーの ランク・当選しやすさ」の取込CSV(1行目が見出し: `id,rank,weight`。列の順は自由)を読む。
 * rank / weight が空のセルは「今の値を保つ」。メンバーの追加や写真は共通の名簿の仕事なので、ここでは扱わない。
 * TODO: 本格的な CSV パーサ(RFC4180・Shift_JIS)は名簿の CSV 取込で用意するので、そちらができたら置き換える。
 */
export function parseMemberExtrasCsv(text: string): { rows: MemberExtrasRow[]; errors: string[] } {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    const errors: string[] = [];
    if (lines.length === 0) return { rows: [], errors: ['CSV が空です'] };
    const header = splitLine(lines[0]).map((h) => h.toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const idCol = col('id');
    if (idCol === -1) return { rows: [], errors: ['1行目の見出しに id がありません(id,rank,weight)'] };
    const rankCol = col('rank');
    const weightCol = col('weight');
    const rows: MemberExtrasRow[] = [];
    const seen = new Set<string>();
    lines.slice(1).forEach((line, i) => {
        const where = `${i + 2}行目`;
        const cells = splitLine(line);
        const id = cells[idCol] ?? '';
        if (!id) return void errors.push(`${where}: id が空です`);
        if (seen.has(id)) return void errors.push(`${where}: id「${id}」が重複しています`);
        seen.add(id);
        const row: MemberExtrasRow = { id };
        const rank = rankCol === -1 ? '' : (cells[rankCol] ?? '');
        if (rank) {
            const n = Number(rank);
            if (!Number.isInteger(n) || n < 1) return void errors.push(`${where}: rank は1以上の整数にしてください`);
            row.rank = n;
        }
        const weight = weightCol === -1 ? '' : (cells[weightCol] ?? '');
        if (weight) {
            const n = Number(weight);
            if (!Number.isInteger(n) || n < MIN_WEIGHT || n > MAX_WEIGHT) {
                return void errors.push(`${where}: weight は${MIN_WEIGHT}〜${MAX_WEIGHT}の整数にしてください`);
            }
            row.weight = n;
        }
        rows.push(row);
    });
    return { rows, errors };
}
