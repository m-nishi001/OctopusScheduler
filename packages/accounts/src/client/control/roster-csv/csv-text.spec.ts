import { describe, expect, it } from "vitest";
import { decodeCsvBytes, parseCsv, stringifyCsv } from "./csv-text";

const cells = (text: string) => parseCsv(text).map((r) => r.cells);

describe("parseCsv", () => {
  it("CRLF・LF・CR、末尾の改行の有無、空行を扱う", () => {
    expect(cells("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(cells("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(cells("a,b\r1,2\r\n\r\n3,4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("引用符・カンマ・セル内の改行・\"\" のエスケープ", () => {
    expect(cells('"a,b","x ""y"" z","1\r\n2",end')).toEqual([["a,b", 'x "y" z', "1\r\n2", "end"]]);
    expect(cells('a,"",c')).toEqual([["a", "", "c"]]);
  });

  it("行番号は元のファイルでの位置(空行・セル内改行を数える)", () => {
    const rows = parseCsv('h\n\n"x\ny"\nz');
    expect(rows.map((r) => r.line)).toEqual([1, 3, 5]);
  });

  it("引用符が閉じていなければ例外", () => {
    expect(() => parseCsv('a,"b')).toThrow();
  });
});

describe("decodeCsvBytes", () => {
  it("UTF-8(BOMあり・なし)", () => {
    const utf8 = new TextEncoder().encode("名前");
    expect(decodeCsvBytes(utf8)).toBe("名前");
    expect(decodeCsvBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe("名前");
  });

  it("UTF-8 として読めなければ Shift_JIS", () => {
    // 「名前」の Shift_JIS
    expect(decodeCsvBytes(new Uint8Array([0x96, 0xbc, 0x91, 0x4f]))).toBe("名前");
  });
});

describe("stringifyCsv", () => {
  it("必要なセルだけ引用符で囲み、読み戻すと元に戻る", () => {
    const rows = [["a,b", 'x"y', "1\n2", "plain", ""]];
    const text = stringifyCsv(rows);
    expect(text).toBe('"a,b","x""y","1\n2",plain,\r\n');
    expect(cells(text)).toEqual(rows);
  });
});
