import { describe, expect, it } from 'vitest';
import { parseMemberExtrasCsv } from './member-extras-csv';

describe('parseMemberExtrasCsv', () => {
    it('id をキーに rank / weight を読む。列の順は自由で、空のセルは省略(今の値を保つ)', () => {
        const { rows, errors } = parseMemberExtrasCsv('id,rank,weight\na,3,50\nb,,\nc,2,\n');
        expect(errors).toEqual([]);
        expect(rows).toEqual([{ id: 'a', rank: 3, weight: 50 }, { id: 'b' }, { id: 'c', rank: 2 }]);
        expect(parseMemberExtrasCsv('weight,id\n7,x').rows).toEqual([{ id: 'x', weight: 7 }]);
    });

    it('BOM・CRLF・引用符つきの id を読める', () => {
        const { rows } = parseMemberExtrasCsv('\uFEFFid,rank\r\n"a,1",4\r\n');
        expect(rows).toEqual([{ id: 'a,1', rank: 4 }]);
    });

    it('見出しに id が無い・空のCSVはエラー', () => {
        expect(parseMemberExtrasCsv('名前,ランク\nA,1').errors[0]).toContain('id');
        expect(parseMemberExtrasCsv('').errors).toHaveLength(1);
    });

    it('id が空・重複、rank / weight が範囲外の行はエラーにする(行番号つき)', () => {
        const { rows, errors } = parseMemberExtrasCsv('id,rank,weight\n,1,1\na,0,1\nb,1,101\nc,x,1\nd,1,1\nd,1,1');
        expect(rows).toEqual([{ id: 'd', rank: 1, weight: 1 }]);
        expect(errors).toHaveLength(5);
        expect(errors[0]).toContain('2行目');
        expect(errors[4]).toContain('重複');
    });
});
